import {
  getBase58Decoder,
  getBase64Encoder,
  type Address,
  type ReadonlyUint8Array,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
} from "@solana-program/token";

import {
  CREATOR_DISCRIMINATOR,
  GOAL_DISCRIMINATOR,
  KADI_PROGRAM_ADDRESS,
  SUPPORTER_DISCRIMINATOR,
  fetchAllMaybeGoal,
  fetchMaybeConfig,
  fetchMaybeCreator,
  fetchMaybeGoal,
  getCreatorDecoder,
  getGoalDecoder,
  getSupporterDecoder,
  type Config,
  type Creator,
  type Goal,
  type Supporter,
} from "@/generated";
import { parseDonationEvents, type DonationEvent } from "./events";
import { findConfigPda, findCreatorPda, findGoalPda, findVaultPda } from "./pda";
import { NATIVE_MINT_SENTINEL } from "./tokens";

export { NATIVE_MINT_SENTINEL };

/// Narrow structural type for the pieces of `client.rpc` used here, so these
/// helpers can be called from both client components and route handlers.
export type KadiRpc = {
  getProgramAccounts: (
    address: Address,
    config: Record<string, unknown>
  ) => { send: () => Promise<readonly RawAccount[]> };
  getBalance: (address: Address) => {
    send: () => Promise<{ value: bigint }>;
  };
  getSignaturesForAddress: (
    address: Address,
    config: Record<string, unknown>
  ) => { send: () => Promise<readonly { signature: string }[]> };
  getTokenAccountBalance: (address: Address) => {
    send: () => Promise<{ value: { amount: string } }>;
  };
  getTransaction: (
    signature: string,
    config: Record<string, unknown>
  ) => {
    send: () => Promise<{ meta?: { logMessages?: readonly string[] } } | null>;
  };
  getAccountInfo: unknown;
  getMultipleAccounts: unknown;
};

type RawAccount = {
  pubkey: Address;
  account: { data: [string, string] };
};

export type WithAddress<T> = { address: Address; data: T };

const base58 = getBase58Decoder();
const base64 = getBase64Encoder();

function discriminatorFilter(discriminator: ReadonlyUint8Array) {
  return {
    memcmp: {
      offset: 0n,
      bytes: base58.decode(discriminator),
      encoding: "base58",
    },
  };
}

function addressFilter(offset: bigint, address: Address) {
  return { memcmp: { offset, bytes: address, encoding: "base58" } };
}

async function getDecodedProgramAccounts<T>(
  rpc: KadiRpc,
  filters: unknown[],
  decode: (bytes: Uint8Array) => T
): Promise<WithAddress<T>[]> {
  const accounts = await rpc
    .getProgramAccounts(KADI_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters,
    })
    .send();

  return accounts.map((entry) => ({
    address: entry.pubkey,
    data: decode(new Uint8Array(base64.encode(entry.account.data[0]))),
  }));
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchConfig(rpc: unknown): Promise<Config | null> {
  const [address] = await findConfigPda();
  const account = await fetchMaybeConfig(rpc as never, address);
  return account.exists ? account.data : null;
}

export async function fetchCreatorByHandle(
  rpc: unknown,
  handle: string
): Promise<WithAddress<Creator> | null> {
  const [address] = await findCreatorPda({ handle });
  const account = await fetchMaybeCreator(rpc as never, address);
  return account.exists ? { address, data: account.data } : null;
}

/// Goal PDAs are derived from a monotonic per-creator counter, so a creator's
/// goals can be fetched by deriving every address and batching one
/// `getMultipleAccounts` — no `getProgramAccounts` scan, which many hosted RPC
/// providers rate-limit or disable outright.
export async function fetchCreatorGoals(
  rpc: unknown,
  creator: Address,
  goalCount: bigint
): Promise<WithAddress<Goal>[]> {
  const count = Number(goalCount);
  if (count === 0) return [];

  const addresses = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      findGoalPda(creator, BigInt(index))
    )
  );

  const accounts = await fetchAllMaybeGoal(rpc as never, addresses);
  return accounts
    .filter((account) => account.exists)
    .map((account) => ({
      address: account.address,
      data: account.data as Goal,
    }));
}

export async function fetchGoalAt(
  rpc: unknown,
  creator: Address,
  index: bigint
): Promise<WithAddress<Goal> | null> {
  const address = await findGoalPda(creator, index);
  const account = await fetchMaybeGoal(rpc as never, address);
  return account.exists ? { address, data: account.data } : null;
}

/// The leaderboard. Donors are not known ahead of time, so this is the one
/// place a program-accounts scan is unavoidable.
export async function fetchGoalSupporters(
  rpc: KadiRpc,
  goal: Address
): Promise<WithAddress<Supporter>[]> {
  const supporters = await getDecodedProgramAccounts(
    rpc,
    [discriminatorFilter(SUPPORTER_DISCRIMINATOR), addressFilter(8n, goal)],
    (bytes) => getSupporterDecoder().decode(bytes)
  );

  return supporters.sort((a, b) => (b.data.total > a.data.total ? 1 : -1));
}

/// Every goal on the protocol, newest first — powers the landing page feed and
/// the aggregate stats. Cheap on localnet and devnet; a production deployment
/// would put this behind a cached indexer.
export async function fetchAllGoals(rpc: KadiRpc): Promise<WithAddress<Goal>[]> {
  const goals = await getDecodedProgramAccounts(
    rpc,
    [discriminatorFilter(GOAL_DISCRIMINATOR)],
    (bytes) => getGoalDecoder().decode(bytes)
  );

  return goals.sort((a, b) => Number(b.data.createdAt - a.data.createdAt));
}

/// Reverse lookup for the dashboard: a creator PDA is seeded by handle, so
/// going wallet → profile needs a filtered scan on the owner field.
export async function fetchCreatorByOwner(
  rpc: KadiRpc,
  owner: Address
): Promise<WithAddress<Creator> | null> {
  const creators = await getDecodedProgramAccounts(
    rpc,
    [discriminatorFilter(CREATOR_DISCRIMINATOR), addressFilter(8n, owner)],
    (bytes) => getCreatorDecoder().decode(bytes)
  );
  return creators[0] ?? null;
}

/// Lamports a creator can actually withdraw. Mirrors `claim_sol`: the vault's
/// rent-exempt floor is never claimable.
export const VAULT_RENT_FLOOR = 890_880n;

export async function fetchClaimable(
  rpc: KadiRpc,
  goal: Address
): Promise<bigint> {
  const [vault] = await findVaultPda({ goal });
  const balance = await rpc.getBalance(vault).send();
  const value = BigInt(balance.value);
  return value > VAULT_RENT_FLOOR ? value - VAULT_RENT_FLOOR : 0n;
}

/// Token balance of an associated token account, or 0 if it does not exist
/// yet. A missing ATA is the normal state for a donor who has never held the
/// mint, so it is not an error.
async function tokenAccountBalance(
  rpc: KadiRpc,
  account: Address
): Promise<bigint> {
  try {
    const balance = await rpc.getTokenAccountBalance(account).send();
    return BigInt(balance.value.amount);
  } catch {
    return 0n;
  }
}

/// Tokens a creator can withdraw from a token-denominated goal. The SPL vault
/// has no rent floor to subtract — unlike the SOL vault, the token account's
/// rent lives in its own lamport balance.
export async function fetchTokenClaimable(
  rpc: KadiRpc,
  goal: Address,
  mint: Address
): Promise<bigint> {
  const [vault] = await findVaultPda({ goal });
  const [vaultTokenAccount] = await findAssociatedTokenPda({
    mint,
    owner: vault,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return tokenAccountBalance(rpc, vaultTokenAccount);
}

/// What the connected donor actually holds, so the donate form can warn before
/// the wallet rejects the transaction.
export async function fetchTokenBalance(
  rpc: KadiRpc,
  owner: Address,
  mint: Address
): Promise<bigint> {
  const [account] = await findAssociatedTokenPda({
    mint,
    owner,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  return tokenAccountBalance(rpc, account);
}

export type RecordedDonation = DonationEvent & { signature: string };

/// Donation history, reconstructed from the goal's transaction log. The
/// messages live in Anchor event data, so the ledger *is* the feed — there is
/// no database to fall out of sync.
export async function fetchRecentDonations(
  rpc: KadiRpc,
  goal: Address,
  limit = 8
): Promise<RecordedDonation[]> {
  const signatures = await rpc
    .getSignaturesForAddress(goal, { limit })
    .send()
    .catch(() => [] as readonly { signature: string }[]);

  const batches = await Promise.all(
    signatures.map(async ({ signature }) => {
      const transaction = await rpc
        .getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          encoding: "json",
        })
        .send()
        .catch(() => null);

      return parseDonationEvents(transaction?.meta?.logMessages).map(
        (event) => ({ ...event, signature })
      );
    })
  );

  return batches.flat();
}

export type ProtocolStats = {
  totalRaised: bigint;
  goalCount: number;
  creatorCount: number;
  donationCount: bigint;
};

export function summarise(goals: WithAddress<Goal>[]): ProtocolStats {
  const creators = new Set<string>();
  let totalRaised = 0n;
  let donationCount = 0n;

  for (const { data } of goals) {
    if (data.mint === NATIVE_MINT_SENTINEL) {
      totalRaised += data.raised; // only native goals are summed in lamports
    }
    donationCount += data.donationCount;
    creators.add(data.creator);
  }

  return {
    totalRaised,
    goalCount: goals.length,
    creatorCount: creators.size,
    donationCount,
  };
}
