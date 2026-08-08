import "server-only";

import { unwrapOption, type Address } from "@solana/kit";

import {
  KADI_PROGRAM_ADDRESS,
  fetchAllMaybeCreator,
  fetchAllMaybeGoal,
  type Creator,
  type Goal,
} from "@/generated";
import { parseDonationEvents } from "../events";
import {
  fetchAllCreators,
  fetchAllGoals,
  type KadiRpc,
} from "../queries";
import {
  insertDonations,
  getIndexerState,
  setIndexerState,
  upsertCreators,
  upsertGoals,
  type DonationRecord,
} from "../db/write";
import { serverRpc } from "./rpc";

/// The chain → Postgres projection.
///
/// Kadi's design decision was that the ledger *is* the database, and that has
/// not changed: nothing here is authoritative and the tables can be dropped and
/// rebuilt by replaying signatures. What it buys is the one thing reading from
/// chain cannot give — a landing page, a search and a leaderboard that do not
/// each cost a `getProgramAccounts` scan, which every hosted RPC throttles and
/// some disable outright.
///
/// Two paths write here, and they are deliberately allowed to overlap:
///
///   * `syncAll` — the scheduled sweep. Refreshes account state and walks every
///     signature since the stored cursor.
///   * `ingestSignature` — the write-through. The browser reports a donation the
///     moment its transaction confirms, so the feed updates in the same second
///     rather than on the next cron tick.
///
/// Donations are keyed by `(signature, event_index)` and inserted with
/// `on conflict do nothing`, so the two racing on the same transaction is a
/// no-op rather than a duplicate.

export type SyncReport = {
  creators: number;
  goals: number;
  signaturesScanned: number;
  donationsAdded: number;
  cursor: string | null;
  tookMs: number;
};

/// How many signatures one pass will walk. A cold start on a busy program
/// would otherwise try to pull the entire history into a single request and
/// time out; capping it means the first few runs catch up in stages and every
/// later run has almost nothing to do.
const MAX_SIGNATURES_PER_RUN = 2_000;
const SIGNATURE_PAGE = 500;
const TRANSACTION_CONCURRENCY = 8;

// ---------------------------------------------------------------------------
// Account state
// ---------------------------------------------------------------------------

function creatorRecord(address: Address, data: Creator) {
  return {
    address,
    owner: data.owner,
    handle: data.handle,
    displayName: data.displayName,
    bio: data.bio,
    avatarUri: data.avatarUri,
    goalCount: Number(data.goalCount),
    createdAt: data.createdAt,
  };
}

function goalRecord(address: Address, data: Goal) {
  return {
    address,
    creatorAddress: data.creator,
    index: Number(data.index),
    title: data.title,
    description: data.description,
    mint: data.mint,
    target: data.target,
    raised: data.raised,
    claimed: data.claimed,
    donationCount: data.donationCount,
    supporterCount: Number(data.supporterCount),
    // `GoalStatus` is a plain numeric enum with the same ordering the column
    // stores, so the discriminant is the column value.
    status: Number(data.status),
    deadline: unwrapOption(data.deadline),
    createdAt: data.createdAt,
  };
}

/// Full refresh of every account the program owns. Two `getProgramAccounts`
/// scans — the calls this whole module exists to keep off the request path.
export async function syncAccounts(
  rpc: KadiRpc
): Promise<{ creators: number; goals: number }> {
  const [creators, goals] = await Promise.all([
    fetchAllCreators(rpc),
    fetchAllGoals(rpc),
  ]);

  // Creators first: goal rows carry a creator address, and a page that joins
  // them should never see a goal whose creator has not landed yet.
  const creatorCount = await upsertCreators(
    creators.map(({ address, data }) => creatorRecord(address, data))
  );

  const goalCount = await upsertGoals(
    goals.map(({ address, data }) => goalRecord(address, data))
  );

  return { creators: creatorCount, goals: goalCount };
}

/// Targeted refresh: fetches only the named accounts. This is what the
/// write-through uses, because a scan of the whole program on every confirmed
/// donation would reintroduce exactly the cost the cache removes.
async function refreshAccounts(
  rpc: KadiRpc,
  goalAddresses: Address[],
  creatorAddresses: Address[]
): Promise<void> {
  const [creators, goals] = await Promise.all([
    creatorAddresses.length
      ? fetchAllMaybeCreator(rpc as never, creatorAddresses)
      : Promise.resolve([]),
    goalAddresses.length
      ? fetchAllMaybeGoal(rpc as never, goalAddresses)
      : Promise.resolve([]),
  ]);

  await upsertCreators(
    creators
      .filter((account) => account.exists)
      .map((account) => creatorRecord(account.address, account.data as Creator))
  );

  await upsertGoals(
    goals
      .filter((account) => account.exists)
      .map((account) => goalRecord(account.address, account.data as Goal))
  );
}

// ---------------------------------------------------------------------------
// Donation log
// ---------------------------------------------------------------------------

type SignatureEntry = {
  signature: string;
  slot?: bigint | number;
  blockTime?: bigint | number | null;
  err?: unknown;
};

/// Collects signatures newer than `until`, newest first, paging backwards.
async function collectSignatures(
  rpc: KadiRpc,
  until: string | null,
  budget: number
): Promise<SignatureEntry[]> {
  const collected: SignatureEntry[] = [];
  let before: string | undefined;

  while (collected.length < budget) {
    const page = await rpc
      .getSignaturesForAddress(KADI_PROGRAM_ADDRESS, {
        limit: Math.min(SIGNATURE_PAGE, budget - collected.length),
        ...(until ? { until } : {}),
        ...(before ? { before } : {}),
      })
      .send();

    if (page.length === 0) break;
    collected.push(...page);

    // A short page means the endpoint had nothing more to give.
    if (page.length < SIGNATURE_PAGE) break;
    before = page[page.length - 1].signature;
  }

  return collected;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, run)
  );
  return results;
}

async function donationsInTransaction(
  rpc: KadiRpc,
  entry: SignatureEntry
): Promise<DonationRecord[]> {
  // A failed transaction never emitted anything and never moved funds.
  if (entry.err) return [];

  const transaction = await rpc
    .getTransaction(entry.signature, {
      maxSupportedTransactionVersion: 0,
      encoding: "json",
    })
    .send()
    .catch(() => null);

  if (!transaction || transaction.meta?.err) return [];

  const events = parseDonationEvents(transaction.meta?.logMessages);
  const slot = transaction.slot ?? entry.slot ?? null;

  return events.map((event, eventIndex) => ({
    signature: entry.signature,
    eventIndex,
    goalAddress: event.goal,
    creatorAddress: event.creator,
    donor: event.donor,
    mint: event.mint,
    amount: event.amount,
    net: event.net,
    fee: event.fee,
    message: event.message,
    raisedAfter: event.raised,
    targetAtTime: event.target,
    isFirstTime: event.isFirstTime,
    // The event carries the program's own `Clock` reading, which is what every
    // other surface already displays. `blockTime` is only the fallback.
    blockTime: event.timestamp > 0n ? event.timestamp : toBigIntOr(entry.blockTime, 0n),
    slot: slot === null ? null : BigInt(slot),
  }));
}

function toBigIntOr(
  value: bigint | number | null | undefined,
  fallback: bigint
): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.floor(value));
  return fallback;
}

export async function syncDonations(
  rpc: KadiRpc,
  options: { budget?: number; from?: string | null } = {}
): Promise<{ scanned: number; added: number; cursor: string | null }> {
  const state = await getIndexerState();
  const until = options.from !== undefined ? options.from : state.lastSignature;
  const budget = options.budget ?? MAX_SIGNATURES_PER_RUN;

  const signatures = await collectSignatures(rpc, until, budget);
  if (signatures.length === 0) {
    return { scanned: 0, added: 0, cursor: state.lastSignature };
  }

  const batches = await mapWithConcurrency(
    signatures,
    TRANSACTION_CONCURRENCY,
    (entry) => donationsInTransaction(rpc, entry)
  );

  const records = batches.flat();
  const added = await insertDonations(records);

  // The newest signature only becomes the cursor once its transaction has been
  // read and stored. Advancing it first would silently skip a page if the run
  // failed halfway.
  const cursor = signatures[0].signature;
  await setIndexerState({
    lastSignature: cursor,
    lastSlot: toBigIntOr(signatures[0].slot, 0n) || null,
    donationsAdded: added,
  });

  return { scanned: signatures.length, added, cursor };
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export async function syncAll(
  options: { full?: boolean; budget?: number } = {}
): Promise<SyncReport> {
  const startedAt = Date.now();
  const rpc = serverRpc();

  const accounts = await syncAccounts(rpc);
  const donations = await syncDonations(rpc, {
    budget: options.budget,
    // A full run rewalks the entire history rather than resuming, which is how
    // a database restored from nothing catches up.
    ...(options.full ? { from: null } : {}),
  });

  return {
    creators: accounts.creators,
    goals: accounts.goals,
    signaturesScanned: donations.scanned,
    donationsAdded: donations.added,
    cursor: donations.cursor,
    tookMs: Date.now() - startedAt,
  };
}

/// Write-through for a single confirmed transaction.
///
/// Deliberately does not touch the cursor: this runs out of order with respect
/// to the sweep, and moving the cursor forward from here would strand every
/// signature in between. The sweep will see this transaction again and insert
/// nothing.
export async function ingestSignature(
  signature: string
): Promise<{ added: number; goals: string[] }> {
  const rpc = serverRpc();
  const records = await donationsInTransaction(rpc, { signature });
  if (records.length === 0) return { added: 0, goals: [] };

  const added = await insertDonations(records);

  // The donation moved `raised`, `donation_count` and possibly
  // `supporter_count` on the goal account, so the mirrored rows are now stale.
  // Only the accounts this transaction actually touched are re-read.
  const goals = [...new Set(records.map((record) => record.goalAddress))];
  const creators = [...new Set(records.map((record) => record.creatorAddress))];
  await refreshAccounts(rpc, goals as Address[], creators as Address[]);

  return { added, goals };
}
