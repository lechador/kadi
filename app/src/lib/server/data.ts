import "server-only";

import { unwrapOption, type Address } from "@solana/kit";

import type { Creator, Goal } from "@/generated";
import { isDatabaseConfigured } from "../db/client";
import * as db from "../db/read";
import type { GoalFilter } from "../db/read";
import {
  fetchAllCreators,
  fetchAllGoals,
  fetchConfig,
  fetchCreatorByHandle,
  fetchCreatorGoals,
  fetchGoalAt,
  fetchGoalSupporters,
  fetchRecentDonations,
  type KadiRpc,
  type WithAddress,
} from "../queries";
import { NATIVE_MINT_SENTINEL } from "../tokens";
import type {
  CreatorView,
  DonationView,
  GoalView,
  StatsView,
  SupporterView,
} from "../views";
import { serverRpc } from "./rpc";

/// Every read a page makes, with the cache in front and the chain behind it.
///
/// `DATABASE_URL` unset is a first-class state, not a degraded one: Kadi
/// shipped without a database and the chain is still the source of truth. What
/// changes without the cache is cost and latency, never correctness — so each
/// function here answers from Postgres when it can and falls back to the same
/// RPC calls the app used before. `source` is returned so the UI can say which
/// one answered rather than quietly implying freshness it does not have.

export type Sourced<T> = { data: T; source: "db" | "chain" };

function statusCode(goal: Goal): number {
  return Number(goal.status);
}

function goalFromChain(
  goal: WithAddress<Goal>,
  creators: Map<string, Creator>
): GoalView {
  const creator = creators.get(goal.data.creator);
  return {
    address: goal.address,
    creatorAddress: goal.data.creator,
    handle: creator?.handle ?? "",
    creatorName: creator?.displayName || `@${creator?.handle ?? ""}`,
    creatorAvatar: creator?.avatarUri || null,
    index: Number(goal.data.index),
    title: goal.data.title,
    description: goal.data.description,
    mint: goal.data.mint,
    target: goal.data.target.toString(),
    raised: goal.data.raised.toString(),
    claimed: goal.data.claimed.toString(),
    donationCount: Number(goal.data.donationCount),
    supporterCount: Number(goal.data.supporterCount),
    status: statusCode(goal.data),
    deadline: (() => {
      const deadline = unwrapOption(goal.data.deadline);
      return deadline === null ? null : Number(deadline);
    })(),
    createdAt: Number(goal.data.createdAt),
  };
}

function creatorFromChain(creator: WithAddress<Creator>): CreatorView {
  return {
    address: creator.address,
    owner: creator.data.owner,
    handle: creator.data.handle,
    displayName: creator.data.displayName,
    bio: creator.data.bio,
    avatarUri: creator.data.avatarUri,
    goalCount: Number(creator.data.goalCount),
    createdAt: Number(creator.data.createdAt),
    profile: null,
  };
}

async function chainGoalsWithHandles(rpc: KadiRpc): Promise<GoalView[]> {
  const [goals, creators] = await Promise.all([
    fetchAllGoals(rpc),
    fetchAllCreators(rpc),
  ]);
  const byAddress = new Map(
    creators.map((creator) => [creator.address as string, creator.data])
  );
  return goals.map((goal) => goalFromChain(goal, byAddress));
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

const STATUS_CODES: Record<string, number> = {
  active: 0,
  completed: 1,
  archived: 2,
};

/// The fallback repeats the database's filtering in memory. It is only ever
/// reached without a cache, where the whole goal set is one scan anyway.
function filterInMemory(goals: GoalView[], filter: GoalFilter): GoalView[] {
  const {
    status = "active",
    denomination = "all",
    search = null,
    creatorAddress = null,
    sort = "trending",
    limit = 24,
    offset = 0,
  } = filter;

  let result = goals;

  if (status !== "all") {
    result = result.filter((goal) => goal.status === STATUS_CODES[status]);
  }
  if (denomination === "sol") {
    result = result.filter((goal) => goal.mint === NATIVE_MINT_SENTINEL);
  } else if (denomination === "token") {
    result = result.filter((goal) => goal.mint !== NATIVE_MINT_SENTINEL);
  } else if (denomination !== "all") {
    result = result.filter((goal) => goal.mint === denomination);
  }
  if (creatorAddress) {
    result = result.filter((goal) => goal.creatorAddress === creatorAddress);
  }
  if (search?.trim()) {
    const needle = search.trim().toLowerCase();
    result = result.filter((goal) =>
      [goal.title, goal.description, goal.handle, goal.creatorName]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }

  const share = (goal: GoalView) => {
    const target = BigInt(goal.target);
    if (target <= 0n) return 0;
    return Number((BigInt(goal.raised) * 10_000n) / target) / 10_000;
  };

  const sorted = [...result];
  if (sort === "newest" || sort === "trending") {
    // Without the donation table there is no recency signal to rank by, so
    // "trending" degrades to "newest" rather than inventing an ordering.
    sorted.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sort === "progress") {
    sorted.sort((a, b) => share(b) - share(a));
  } else {
    sorted.sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity));
  }

  return sorted.slice(offset, offset + limit);
}

export async function loadGoals(
  filter: GoalFilter = {}
): Promise<Sourced<GoalView[]>> {
  if (isDatabaseConfigured()) {
    try {
      return { data: await db.listGoals(filter), source: "db" };
    } catch (error) {
      console.error("[kadi] goal list fell back to chain:", error);
    }
  }
  const goals = await chainGoalsWithHandles(serverRpc());
  return { data: filterInMemory(goals, filter), source: "chain" };
}

export async function loadGoalCount(filter: GoalFilter = {}): Promise<number> {
  if (isDatabaseConfigured()) {
    try {
      return await db.countGoals(filter);
    } catch {
      // Falls through to the chain count below.
    }
  }
  const goals = await chainGoalsWithHandles(serverRpc());
  return filterInMemory(goals, { ...filter, limit: 1_000, offset: 0 }).length;
}

export async function loadGoal(
  handle: string,
  index: number
): Promise<Sourced<GoalView | null>> {
  if (isDatabaseConfigured()) {
    try {
      const goal = await db.getGoal(handle, index);
      if (goal) return { data: goal, source: "db" };
    } catch (error) {
      console.error("[kadi] goal read fell back to chain:", error);
    }
  }

  const rpc = serverRpc();
  const creator = await fetchCreatorByHandle(rpc, handle);
  if (!creator) return { data: null, source: "chain" };

  const goal = await fetchGoalAt(rpc, creator.address, BigInt(index));
  if (!goal) return { data: null, source: "chain" };

  return {
    data: goalFromChain(goal, new Map([[creator.address, creator.data]])),
    source: "chain",
  };
}

export async function loadCreatorGoals(
  creator: CreatorView
): Promise<Sourced<GoalView[]>> {
  if (isDatabaseConfigured()) {
    try {
      const goals = await db.listCreatorGoals(creator.address);
      if (goals.length > 0 || creator.goalCount === 0) {
        return { data: goals, source: "db" };
      }
    } catch (error) {
      console.error("[kadi] creator goals fell back to chain:", error);
    }
  }

  const goals = await fetchCreatorGoals(
    serverRpc(),
    creator.address as Address,
    BigInt(creator.goalCount)
  );
  const creators = new Map<string, Creator>([
    [
      creator.address,
      {
        handle: creator.handle,
        displayName: creator.displayName,
        avatarUri: creator.avatarUri,
      } as Creator,
    ],
  ]);
  return { data: goals.map((goal) => goalFromChain(goal, creators)), source: "chain" };
}

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------

export async function loadCreator(
  handle: string
): Promise<Sourced<CreatorView | null>> {
  // The off-chain profile only exists in Postgres, so the cache is consulted
  // even when the chain would answer — and the chain result is used to fill in
  // anything the cache has not caught up on yet.
  if (isDatabaseConfigured()) {
    try {
      const creator = await db.getCreatorByHandle(handle);
      if (creator) return { data: creator, source: "db" };
    } catch (error) {
      console.error("[kadi] creator read fell back to chain:", error);
    }
  }

  const creator = await fetchCreatorByHandle(serverRpc(), handle);
  return { data: creator ? creatorFromChain(creator) : null, source: "chain" };
}

export async function loadCreators(options: {
  search?: string | null;
  category?: string | null;
  limit?: number;
} = {}): Promise<Sourced<CreatorView[]>> {
  if (isDatabaseConfigured()) {
    try {
      return { data: await db.listCreators(options), source: "db" };
    } catch (error) {
      console.error("[kadi] creator list fell back to chain:", error);
    }
  }

  const creators = await fetchAllCreators(serverRpc());
  const needle = options.search?.trim().toLowerCase();
  const mapped = creators.map(creatorFromChain).filter((creator) =>
    needle
      ? `${creator.handle} ${creator.displayName}`.toLowerCase().includes(needle)
      : true
  );
  return { data: mapped.slice(0, options.limit ?? 24), source: "chain" };
}

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

export async function loadGoalDonations(
  goalAddress: string,
  limit = 20
): Promise<Sourced<DonationView[]>> {
  if (isDatabaseConfigured()) {
    try {
      return {
        data: await db.listGoalDonations(goalAddress, limit),
        source: "db",
      };
    } catch (error) {
      console.error("[kadi] donation list fell back to chain:", error);
    }
  }

  const donations = await fetchRecentDonations(
    serverRpc(),
    goalAddress as Address,
    limit
  );
  return {
    data: donations.map((donation) => ({
      signature: donation.signature,
      eventIndex: 0,
      goalAddress: donation.goal,
      creatorAddress: donation.creator,
      handle: null,
      goalTitle: null,
      goalIndex: null,
      donor: donation.donor,
      mint: donation.mint,
      amount: donation.amount.toString(),
      net: donation.net.toString(),
      fee: donation.fee.toString(),
      message: donation.message,
      isFirstTime: donation.isFirstTime,
      timestamp: Number(donation.timestamp),
    })),
    source: "chain",
  };
}

/// The global feed. There is no chain fallback on purpose: reconstructing it
/// would mean walking every signature the program has ever produced on each
/// page view, which is the exact cost this cache exists to avoid. Without a
/// database the page says so instead of pretending to be slow.
export async function loadRecentDonations(options: {
  limit?: number;
  offset?: number;
  mint?: string | null;
} = {}): Promise<Sourced<DonationView[]>> {
  if (!isDatabaseConfigured()) return { data: [], source: "chain" };
  try {
    return { data: await db.listRecentDonations(options), source: "db" };
  } catch (error) {
    console.error("[kadi] activity feed unavailable:", error);
    return { data: [], source: "chain" };
  }
}

export async function loadGoalSupporters(
  goalAddress: string,
  limit = 10
): Promise<Sourced<SupporterView[]>> {
  if (isDatabaseConfigured()) {
    try {
      const supporters = await db.listGoalSupporters(goalAddress, limit);
      if (supporters.length > 0) return { data: supporters, source: "db" };
    } catch (error) {
      console.error("[kadi] leaderboard fell back to chain:", error);
    }
  }

  const supporters = await fetchGoalSupporters(
    serverRpc(),
    goalAddress as Address
  );
  return {
    data: supporters.slice(0, limit).map((supporter) => ({
      donor: supporter.data.donor,
      total: supporter.data.total.toString(),
      count: Number(supporter.data.count),
      lastAt: Number(supporter.data.lastDonatedAt),
    })),
    source: "chain",
  };
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function loadStats(): Promise<Sourced<StatsView>> {
  if (isDatabaseConfigured()) {
    try {
      return { data: await db.getStats(), source: "db" };
    } catch (error) {
      console.error("[kadi] stats fell back to chain:", error);
    }
  }

  const goals = await chainGoalsWithHandles(serverRpc());
  const creators = new Set(goals.map((goal) => goal.creatorAddress));
  let totalRaised = 0n;
  let donationCount = 0;
  let supporterCount = 0;

  for (const goal of goals) {
    if (goal.mint === NATIVE_MINT_SENTINEL) totalRaised += BigInt(goal.raised);
    donationCount += goal.donationCount;
    supporterCount += goal.supporterCount;
  }

  return {
    data: {
      totalRaised: totalRaised.toString(),
      // Only the donation log records fees per transaction; without it the
      // figure is left at zero rather than estimated from a fee that may have
      // changed since.
      totalFees: "0",
      donationCount,
      creatorCount: creators.size,
      goalCount: goals.length,
      activeGoalCount: goals.filter((goal) => goal.status === 0).length,
      supporterCount,
    },
    source: "chain",
  };
}

/// Treasury and fee, read from chain every time on purpose. It is one account
/// read, and it is the number the donate widget quotes to a donor before they
/// approve a transfer — a cached fee that had since changed would be a lie
/// about where their money goes.
export async function loadConfig(): Promise<{
  treasury: string;
  feeBps: number;
} | null> {
  const config = await fetchConfig(serverRpc());
  return config
    ? { treasury: config.treasury, feeBps: config.feeBps }
    : null;
}

export async function loadOverlaySettings(creatorAddress: string) {
  if (!isDatabaseConfigured()) return null;
  try {
    return await db.getOverlaySettings(creatorAddress);
  } catch {
    return null;
  }
}
