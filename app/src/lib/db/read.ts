import "server-only";

import {
  first,
  query,
  sql,
  toBigInt,
  toNumber,
  toText,
  toUnixSeconds,
  type Row,
} from "./client";
import { NATIVE_MINT_SENTINEL } from "../tokens";
import type {
  CreatorView,
  DailyPointView,
  DonationView,
  GoalView,
  OverlaySettingsView,
  ProfileView,
  SortOption,
  StatsView,
  SupporterView,
} from "../views";
import { DEFAULT_OVERLAY_SETTINGS } from "../views";

// ---------------------------------------------------------------------------
// Row → view
// ---------------------------------------------------------------------------

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function toProfile(row: Row): ProfileView | null {
  // The profile is joined in, so an absent row shows up as a set of nulls
  // rather than a missing key. `owner` is only ever null when the LEFT JOIN
  // found nothing.
  if (row.profile_owner === null || row.profile_owner === undefined) return null;
  return {
    bannerUrl: nullableText(row.banner_url),
    avatarUrl: nullableText(row.avatar_url),
    about: nullableText(row.about),
    category: nullableText(row.category),
    location: nullableText(row.location),
    website: nullableText(row.website),
    twitter: nullableText(row.twitter),
    youtube: nullableText(row.youtube),
    twitch: nullableText(row.twitch),
    instagram: nullableText(row.instagram),
    tiktok: nullableText(row.tiktok),
    discord: nullableText(row.discord),
    accent: nullableText(row.accent),
  };
}

function toCreator(row: Row): CreatorView {
  return {
    address: toText(row.address),
    owner: toText(row.owner),
    handle: toText(row.handle),
    displayName: toText(row.display_name),
    bio: toText(row.bio),
    avatarUri: toText(row.avatar_uri),
    goalCount: toNumber(row.goal_count),
    createdAt: Number(toUnixSeconds(row.created_at)),
    profile: toProfile(row),
  };
}

function toGoal(row: Row): GoalView {
  return {
    address: toText(row.address),
    creatorAddress: toText(row.creator_address),
    handle: toText(row.handle),
    creatorName: toText(row.display_name) || `@${toText(row.handle)}`,
    creatorAvatar: nullableText(row.avatar_url) ?? nullableText(row.avatar_uri),
    index: toNumber(row.goal_index),
    title: toText(row.title),
    description: toText(row.description),
    mint: toText(row.mint),
    target: toBigInt(row.target).toString(),
    raised: toBigInt(row.raised).toString(),
    claimed: toBigInt(row.claimed).toString(),
    donationCount: toNumber(row.donation_count),
    supporterCount: toNumber(row.supporter_count),
    status: toNumber(row.status),
    deadline: row.deadline ? Number(toUnixSeconds(row.deadline)) : null,
    createdAt: Number(toUnixSeconds(row.created_at)),
  };
}

function toDonation(row: Row): DonationView {
  return {
    signature: toText(row.signature),
    eventIndex: toNumber(row.event_index),
    goalAddress: toText(row.goal_address),
    creatorAddress: toText(row.creator_address),
    handle: nullableText(row.handle),
    goalTitle: nullableText(row.title),
    goalIndex: row.goal_index === null || row.goal_index === undefined
      ? null
      : toNumber(row.goal_index),
    donor: toText(row.donor),
    mint: toText(row.mint),
    amount: toBigInt(row.amount).toString(),
    net: toBigInt(row.net).toString(),
    fee: toBigInt(row.fee).toString(),
    message: toText(row.message),
    isFirstTime: row.is_first_time === true,
    timestamp: Number(toUnixSeconds(row.block_time)),
  };
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/// Protocol-wide totals for the landing page. Native SOL is the only
/// denomination summed into a headline figure — adding lamports to USDC base
/// units would produce a number that means nothing.
export async function getStats(): Promise<StatsView> {
  const row = await first(sql`
    select
      coalesce(sum(g.raised) filter (where g.mint = ${NATIVE_MINT_SENTINEL}), 0) as total_raised,
      coalesce(sum(g.donation_count), 0)                                          as donation_count,
      coalesce(sum(g.supporter_count), 0)                                         as supporter_count,
      count(*)                                                                    as goal_count,
      count(*) filter (where g.status = 0)                                        as active_goal_count,
      (select count(*) from creators)                                             as creator_count,
      (select coalesce(sum(d.fee), 0) from donations d
        where d.mint = ${NATIVE_MINT_SENTINEL})                                   as total_fees
    from goals g
  `);

  return {
    totalRaised: toBigInt(row?.total_raised).toString(),
    totalFees: toBigInt(row?.total_fees).toString(),
    donationCount: toNumber(row?.donation_count),
    creatorCount: toNumber(row?.creator_count),
    goalCount: toNumber(row?.goal_count),
    activeGoalCount: toNumber(row?.active_goal_count),
    supporterCount: toNumber(row?.supporter_count),
  };
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

const GOAL_COLUMNS = `
  g.address, g.creator_address, g.goal_index, g.title, g.description, g.mint,
  g.target, g.raised, g.claimed, g.donation_count, g.supporter_count,
  g.status, g.deadline, g.created_at,
  c.handle, c.display_name, c.avatar_uri,
  p.avatar_url
`;

const GOAL_JOINS = `
  from goals g
  join creators c on c.address = g.creator_address
  left join creator_profiles p on p.creator_address = g.creator_address
`;

export type GoalFilter = {
  status?: "active" | "completed" | "archived" | "all";
  /// `sol` / `token` split the two denominations; a base58 mint pins one.
  denomination?: "all" | "sol" | "token" | (string & {});
  category?: string | null;
  search?: string | null;
  creatorAddress?: string | null;
  sort?: SortOption;
  limit?: number;
  offset?: number;
};

const STATUS_CODES: Record<string, number> = {
  active: 0,
  completed: 1,
  archived: 2,
};

const ORDER_BY: Record<SortOption, string> = {
  // Recent donation count first, so a goal that is moving outranks a bigger
  // goal that has stalled. Ties fall back to newest.
  trending: "r.recent_count desc, g.created_at desc",
  newest: "g.created_at desc",
  // Share of target, not absolute amount: goals in different tokens are only
  // comparable as a fraction of what they asked for.
  progress:
    "(case when g.target > 0 then least(g.raised / g.target, 1) else 0 end) desc, g.raised desc",
  // Soonest deadline first; goals without one sink to the bottom rather than
  // vanishing from the list.
  ending: "g.deadline asc nulls last",
};

/// Collects the WHERE clause once so the list and its count can never disagree
/// about what is being filtered — the classic way a paginated page ends up
/// reporting more results than it can show.
function buildGoalWhere(filter: GoalFilter, params: unknown[]): string {
  const {
    status = "active",
    denomination = "all",
    category = null,
    search = null,
    creatorAddress = null,
  } = filter;

  const where: string[] = [];
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (status !== "all") where.push(`g.status = ${bind(STATUS_CODES[status] ?? 0)}`);

  if (denomination === "sol") {
    where.push(`g.mint = ${bind(NATIVE_MINT_SENTINEL)}`);
  } else if (denomination === "token") {
    where.push(`g.mint <> ${bind(NATIVE_MINT_SENTINEL)}`);
  } else if (denomination !== "all") {
    where.push(`g.mint = ${bind(denomination)}`);
  }

  if (category) where.push(`p.category = ${bind(category)}`);
  if (creatorAddress) where.push(`g.creator_address = ${bind(creatorAddress)}`);

  if (search && search.trim()) {
    // One bound parameter matched against four columns. Trigram indexes make
    // the leading-wildcard ILIKE usable, which a tsvector could not be for
    // partial handles — and Postgres has no Georgian text-search config, so
    // stemming was never on the table.
    const pattern = bind(`%${search.trim()}%`);
    where.push(
      `(g.title ilike ${pattern} or g.description ilike ${pattern} or c.handle ilike ${pattern} or c.display_name ilike ${pattern})`
    );
  }

  return where.length ? `where ${where.join(" and ")}` : "";
}

export async function listGoals(filter: GoalFilter = {}): Promise<GoalView[]> {
  const { sort = "trending", limit = 24, offset = 0 } = filter;

  const params: unknown[] = [];
  const where = buildGoalWhere(filter, params);
  const bind = (value: unknown) => {
    params.push(value);
    return `$${params.length}`;
  };

  const recent =
    sort === "trending"
      ? `left join lateral (
           select count(*) as recent_count
           from donations d
           where d.goal_address = g.address
             and d.block_time > now() - interval '7 days'
         ) r on true`
      : "";

  const rows = await query(
    `select ${GOAL_COLUMNS} ${GOAL_JOINS} ${recent}
     ${where}
     order by ${ORDER_BY[sort]}
     limit ${bind(Math.min(Math.max(limit, 1), 100))}
     offset ${bind(Math.max(offset, 0))}`,
    params
  );

  return rows.map(toGoal);
}

export async function countGoals(filter: GoalFilter = {}): Promise<number> {
  const params: unknown[] = [];
  const where = buildGoalWhere(filter, params);
  const rows = await query(
    `select count(*) as total ${GOAL_JOINS} ${where}`,
    params
  );
  return toNumber(rows[0]?.total);
}

export async function getGoal(
  handle: string,
  index: number
): Promise<GoalView | null> {
  const rows = await query(
    `select ${GOAL_COLUMNS} ${GOAL_JOINS}
     where c.handle = $1 and g.goal_index = $2
     limit 1`,
    [handle, index]
  );
  return rows[0] ? toGoal(rows[0]) : null;
}

export async function listCreatorGoals(
  creatorAddress: string
): Promise<GoalView[]> {
  const rows = await query(
    `select ${GOAL_COLUMNS} ${GOAL_JOINS}
     where g.creator_address = $1
     order by g.goal_index desc`,
    [creatorAddress]
  );
  return rows.map(toGoal);
}

// ---------------------------------------------------------------------------
// Creators
// ---------------------------------------------------------------------------

const CREATOR_COLUMNS = `
  c.address, c.owner, c.handle, c.display_name, c.bio, c.avatar_uri,
  c.goal_count, c.created_at,
  p.owner as profile_owner, p.banner_url, p.avatar_url, p.about, p.category,
  p.location, p.website, p.twitter, p.youtube, p.twitch, p.instagram,
  p.tiktok, p.discord, p.accent
`;

const CREATOR_JOINS = `
  from creators c
  left join creator_profiles p on p.creator_address = c.address
`;

export async function getCreatorByHandle(
  handle: string
): Promise<CreatorView | null> {
  const rows = await query(
    `select ${CREATOR_COLUMNS} ${CREATOR_JOINS} where c.handle = $1 limit 1`,
    [handle]
  );
  return rows[0] ? toCreator(rows[0]) : null;
}

export async function getCreatorByOwner(
  owner: string
): Promise<CreatorView | null> {
  const rows = await query(
    `select ${CREATOR_COLUMNS} ${CREATOR_JOINS} where c.owner = $1 limit 1`,
    [owner]
  );
  return rows[0] ? toCreator(rows[0]) : null;
}

export async function listCreators(options: {
  search?: string | null;
  category?: string | null;
  limit?: number;
} = {}): Promise<CreatorView[]> {
  const { search = null, category = null, limit = 24 } = options;
  const where: string[] = [];
  const params: unknown[] = [];

  function bind(value: unknown): string {
    params.push(value);
    return `$${params.length}`;
  }

  if (category) where.push(`p.category = ${bind(category)}`);
  if (search && search.trim()) {
    const pattern = bind(`%${search.trim()}%`);
    where.push(`(c.handle ilike ${pattern} or c.display_name ilike ${pattern})`);
  }

  const rows = await query(
    `select ${CREATOR_COLUMNS},
            (select coalesce(sum(g.raised), 0) from goals g
              where g.creator_address = c.address and g.mint = ${bind(NATIVE_MINT_SENTINEL)}) as sol_raised
     ${CREATOR_JOINS}
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by sol_raised desc, c.created_at desc
     limit ${bind(Math.min(Math.max(limit, 1), 100))}`,
    params
  );

  return rows.map(toCreator);
}

// ---------------------------------------------------------------------------
// Donations and leaderboards
// ---------------------------------------------------------------------------

export async function listGoalDonations(
  goalAddress: string,
  limit = 20,
  offset = 0
): Promise<DonationView[]> {
  const rows = await query(
    `select d.*, c.handle, g.title, g.goal_index
     from donations d
     left join goals g on g.address = d.goal_address
     left join creators c on c.address = d.creator_address
     where d.goal_address = $1
     order by d.block_time desc, d.signature desc
     limit $2 offset $3`,
    [goalAddress, Math.min(Math.max(limit, 1), 100), Math.max(offset, 0)]
  );
  return rows.map(toDonation);
}

/// The global activity feed. `mint` narrows it to one denomination so a page
/// can show a single, comparable column of amounts.
export async function listRecentDonations(options: {
  limit?: number;
  offset?: number;
  creatorAddress?: string | null;
  mint?: string | null;
} = {}): Promise<DonationView[]> {
  const {
    limit = 30,
    offset = 0,
    creatorAddress = null,
    mint = null,
  } = options;

  const where: string[] = [];
  const params: unknown[] = [];

  function bind(value: unknown): string {
    params.push(value);
    return `$${params.length}`;
  }

  if (creatorAddress) where.push(`d.creator_address = ${bind(creatorAddress)}`);
  if (mint) where.push(`d.mint = ${bind(mint)}`);

  const rows = await query(
    `select d.*, c.handle, g.title, g.goal_index
     from donations d
     left join goals g on g.address = d.goal_address
     left join creators c on c.address = d.creator_address
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by d.block_time desc, d.signature desc
     limit ${bind(Math.min(Math.max(limit, 1), 100))}
     offset ${bind(Math.max(offset, 0))}`,
    params
  );
  return rows.map(toDonation);
}

/// Rebuilt from the donation log rather than stored, so it can never drift
/// from it. `sum(amount)` matches the on-chain `Supporter.total`, which
/// accumulates the gross donation, not the post-fee amount.
export async function listGoalSupporters(
  goalAddress: string,
  limit = 10
): Promise<SupporterView[]> {
  const rows = await sql`
    select donor,
           sum(amount)     as total,
           count(*)        as count,
           max(block_time) as last_at
    from donations
    where goal_address = ${goalAddress}
    group by donor
    order by total desc
    limit ${Math.min(Math.max(limit, 1), 50)}
  `;

  return rows.map((row) => ({
    donor: toText(row.donor),
    total: toBigInt(row.total).toString(),
    count: toNumber(row.count),
    lastAt: Number(toUnixSeconds(row.last_at)),
  }));
}

// ---------------------------------------------------------------------------
// Creator analytics
// ---------------------------------------------------------------------------

/// A dense daily series — `generate_series` fills the gaps so a quiet week
/// renders as a flat line instead of collapsing into the neighbouring days.
export async function getCreatorDailyTotals(
  creatorAddress: string,
  mint: string,
  days = 30
): Promise<DailyPointView[]> {
  const span = Math.min(Math.max(days, 1), 365);
  const rows = await query(
    `with span as (
       select generate_series(
         (current_date - ($3::int - 1))::date,
         current_date,
         interval '1 day'
       )::date as day
     )
     select span.day,
            coalesce(sum(d.amount), 0) as amount,
            count(d.*)                 as count
     from span
     left join donations d
       on d.block_time >= span.day
      and d.block_time <  span.day + interval '1 day'
      and d.creator_address = $1
      and d.mint = $2
     group by span.day
     order by span.day`,
    [creatorAddress, mint, span]
  );

  return rows.map((row) => ({
    day:
      row.day instanceof Date
        ? row.day.toISOString().slice(0, 10)
        : String(row.day).slice(0, 10),
    amount: toBigInt(row.amount).toString(),
    count: toNumber(row.count),
  }));
}

export type CreatorTotals = {
  mint: string;
  raised: string;
  fees: string;
  donations: number;
  supporters: number;
};

export async function getCreatorTotals(
  creatorAddress: string
): Promise<CreatorTotals[]> {
  const rows = await sql`
    select mint,
           sum(amount)            as raised,
           sum(fee)               as fees,
           count(*)               as donations,
           count(distinct donor)  as supporters
    from donations
    where creator_address = ${creatorAddress}
    group by mint
    order by raised desc
  `;

  return rows.map((row) => ({
    mint: toText(row.mint),
    raised: toBigInt(row.raised).toString(),
    fees: toBigInt(row.fees).toString(),
    donations: toNumber(row.donations),
    supporters: toNumber(row.supporters),
  }));
}

export async function listCreatorTopSupporters(
  creatorAddress: string,
  limit = 8
): Promise<SupporterView[]> {
  const rows = await sql`
    select donor,
           sum(amount)     as total,
           count(*)        as count,
           max(block_time) as last_at
    from donations
    where creator_address = ${creatorAddress}
      and mint = ${NATIVE_MINT_SENTINEL}
    group by donor
    order by total desc
    limit ${Math.min(Math.max(limit, 1), 50)}
  `;

  return rows.map((row) => ({
    donor: toText(row.donor),
    total: toBigInt(row.total).toString(),
    count: toNumber(row.count),
    lastAt: Number(toUnixSeconds(row.last_at)),
  }));
}

// ---------------------------------------------------------------------------
// Off-chain settings
// ---------------------------------------------------------------------------

export async function getOverlaySettings(
  creatorAddress: string
): Promise<OverlaySettingsView> {
  const row = await first(sql`
    select * from overlay_settings where creator_address = ${creatorAddress}
  `);
  if (!row) return DEFAULT_OVERLAY_SETTINGS;

  return {
    accent: toText(row.accent) || DEFAULT_OVERLAY_SETTINGS.accent,
    alertDurationMs: toNumber(row.alert_duration_ms),
    minAmount: toBigInt(row.min_amount).toString(),
    soundEnabled: row.sound_enabled === true,
    soundUrl: nullableText(row.sound_url),
    ttsEnabled: row.tts_enabled === true,
    ttsVoice: nullableText(row.tts_voice),
    ttsRate: toNumber(row.tts_rate) || 1,
    showBar: row.show_bar !== false,
    pinnedGoalIndex:
      row.pinned_goal_index === null || row.pinned_goal_index === undefined
        ? null
        : toNumber(row.pinned_goal_index),
    alertHeading: nullableText(row.alert_heading),
  };
}

/// Every URL a search engine should know about. Handles and goal indexes are
/// all that is needed — the routes are derived from them.
export async function listSitemapEntries(): Promise<{
  creators: { handle: string; updatedAt: Date }[];
  goals: { handle: string; index: number; updatedAt: Date }[];
}> {
  const [creators, goals] = await Promise.all([
    sql`select handle, synced_at from creators order by handle`,
    sql`
      select c.handle, g.goal_index, g.synced_at
      from goals g
      join creators c on c.address = g.creator_address
      order by c.handle, g.goal_index
    `,
  ]);

  return {
    creators: creators.map((row) => ({
      handle: toText(row.handle),
      updatedAt:
        row.synced_at instanceof Date ? row.synced_at : new Date(),
    })),
    goals: goals.map((row) => ({
      handle: toText(row.handle),
      index: toNumber(row.goal_index),
      updatedAt: row.synced_at instanceof Date ? row.synced_at : new Date(),
    })),
  };
}

export async function listCategoriesInUse(): Promise<
  { category: string; count: number }[]
> {
  const rows = await sql`
    select p.category, count(*) as count
    from creator_profiles p
    where p.category is not null and p.category <> ''
    group by p.category
    order by count desc
  `;
  return rows.map((row) => ({
    category: toText(row.category),
    count: toNumber(row.count),
  }));
}
