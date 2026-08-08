import "server-only";

import {
  first,
  fromUnixSeconds,
  query,
  sql,
  toNumber,
  toText,
  type Row,
} from "./client";
import type { OverlaySettingsView, ProfileView } from "../views";

// ---------------------------------------------------------------------------
// Bulk upserts
//
// A sync pass touches every account the program owns, so each table is written
// in one multi-row statement rather than a round trip per row. Over Neon's
// HTTP driver — one request per statement — that is the difference between a
// sync that takes a second and one that takes a minute.
// ---------------------------------------------------------------------------

/// Builds `($1,$2,$3),($4,$5,$6)…` and the flat parameter list to match.
function valuesClause(rows: unknown[][], params: unknown[]): string {
  return rows
    .map(
      (row) =>
        `(${row
          .map((value) => {
            params.push(value);
            return `$${params.length}`;
          })
          .join(", ")})`
    )
    .join(", ");
}

export type CreatorRecord = {
  address: string;
  owner: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUri: string;
  goalCount: number;
  createdAt: bigint;
};

export async function upsertCreators(records: CreatorRecord[]): Promise<number> {
  if (records.length === 0) return 0;

  const params: unknown[] = [];
  const values = valuesClause(
    records.map((record) => [
      record.address,
      record.owner,
      record.handle,
      record.displayName,
      record.bio,
      record.avatarUri,
      record.goalCount,
      fromUnixSeconds(record.createdAt),
    ]),
    params
  );

  await query(
    `insert into creators
       (address, owner, handle, display_name, bio, avatar_uri, goal_count, created_at)
     values ${values}
     on conflict (address) do update set
       owner        = excluded.owner,
       handle       = excluded.handle,
       display_name = excluded.display_name,
       bio          = excluded.bio,
       avatar_uri   = excluded.avatar_uri,
       goal_count   = excluded.goal_count,
       created_at   = excluded.created_at,
       synced_at    = now()`,
    params
  );

  return records.length;
}

export type GoalRecord = {
  address: string;
  creatorAddress: string;
  index: number;
  title: string;
  description: string;
  mint: string;
  target: bigint;
  raised: bigint;
  claimed: bigint;
  donationCount: bigint;
  supporterCount: number;
  status: number;
  deadline: bigint | null;
  createdAt: bigint;
};

export async function upsertGoals(records: GoalRecord[]): Promise<number> {
  if (records.length === 0) return 0;

  const params: unknown[] = [];
  const values = valuesClause(
    records.map((record) => [
      record.address,
      record.creatorAddress,
      record.index,
      record.title,
      record.description,
      record.mint,
      record.target.toString(),
      record.raised.toString(),
      record.claimed.toString(),
      record.donationCount.toString(),
      record.supporterCount,
      record.status,
      fromUnixSeconds(record.deadline),
      fromUnixSeconds(record.createdAt),
    ]),
    params
  );

  await query(
    `insert into goals
       (address, creator_address, goal_index, title, description, mint,
        target, raised, claimed, donation_count, supporter_count, status,
        deadline, created_at)
     values ${values}
     on conflict (address) do update set
       creator_address = excluded.creator_address,
       goal_index      = excluded.goal_index,
       title           = excluded.title,
       description     = excluded.description,
       mint            = excluded.mint,
       target          = excluded.target,
       raised          = excluded.raised,
       claimed         = excluded.claimed,
       donation_count  = excluded.donation_count,
       supporter_count = excluded.supporter_count,
       status          = excluded.status,
       deadline        = excluded.deadline,
       created_at      = excluded.created_at,
       synced_at       = now()`,
    params
  );

  return records.length;
}

export type DonationRecord = {
  signature: string;
  eventIndex: number;
  goalAddress: string;
  creatorAddress: string;
  donor: string;
  mint: string;
  amount: bigint;
  net: bigint;
  fee: bigint;
  message: string;
  raisedAfter: bigint;
  targetAtTime: bigint;
  isFirstTime: boolean;
  blockTime: bigint;
  slot: bigint | null;
};

/// Returns how many rows were genuinely new. `do nothing` on conflict makes
/// re-ingesting a signature free, which is what lets the write-through path
/// and the cron sweep run over the same transaction without coordinating.
export async function insertDonations(
  records: DonationRecord[]
): Promise<number> {
  if (records.length === 0) return 0;

  const params: unknown[] = [];
  const values = valuesClause(
    records.map((record) => [
      record.signature,
      record.eventIndex,
      record.goalAddress,
      record.creatorAddress,
      record.donor,
      record.mint,
      record.amount.toString(),
      record.net.toString(),
      record.fee.toString(),
      record.message,
      record.raisedAfter.toString(),
      record.targetAtTime.toString(),
      record.isFirstTime,
      fromUnixSeconds(record.blockTime) ?? new Date(),
      record.slot === null ? null : record.slot.toString(),
    ]),
    params
  );

  const inserted = await query(
    `insert into donations
       (signature, event_index, goal_address, creator_address, donor, mint,
        amount, net, fee, message, raised_after, target_at_time,
        is_first_time, block_time, slot)
     values ${values}
     on conflict (signature, event_index) do nothing
     returning signature`,
    params
  );

  return inserted.length;
}

// ---------------------------------------------------------------------------
// Indexer cursor
// ---------------------------------------------------------------------------

export type IndexerState = {
  lastSignature: string | null;
  lastSlot: bigint | null;
  donationsSeen: number;
  updatedAt: Date | null;
};

const CURSOR_ID = "program";

export async function getIndexerState(): Promise<IndexerState> {
  const row = await first(
    sql`select * from indexer_state where id = ${CURSOR_ID}`
  );
  return {
    lastSignature: row ? (toText(row.last_signature) || null) : null,
    lastSlot: row?.last_slot ? BigInt(String(row.last_slot)) : null,
    donationsSeen: toNumber(row?.donations_seen),
    updatedAt: row?.updated_at instanceof Date ? row.updated_at : null,
  };
}

export async function setIndexerState(update: {
  lastSignature: string | null;
  lastSlot: bigint | null;
  donationsAdded: number;
}): Promise<void> {
  await sql`
    insert into indexer_state (id, last_signature, last_slot, donations_seen, updated_at)
    values (
      ${CURSOR_ID},
      ${update.lastSignature},
      ${update.lastSlot === null ? null : update.lastSlot.toString()},
      ${update.donationsAdded},
      now()
    )
    on conflict (id) do update set
      last_signature = coalesce(excluded.last_signature, indexer_state.last_signature),
      last_slot      = coalesce(excluded.last_slot, indexer_state.last_slot),
      donations_seen = indexer_state.donations_seen + excluded.donations_seen,
      updated_at     = now()
  `;
}

// ---------------------------------------------------------------------------
// Off-chain, creator-owned records
// ---------------------------------------------------------------------------

const PROFILE_FIELDS = [
  "banner_url",
  "avatar_url",
  "about",
  "category",
  "location",
  "website",
  "twitter",
  "youtube",
  "twitch",
  "instagram",
  "tiktok",
  "discord",
  "accent",
] as const;

const PROFILE_KEYS: Record<(typeof PROFILE_FIELDS)[number], keyof ProfileView> = {
  banner_url: "bannerUrl",
  avatar_url: "avatarUrl",
  about: "about",
  category: "category",
  location: "location",
  website: "website",
  twitter: "twitter",
  youtube: "youtube",
  twitch: "twitch",
  instagram: "instagram",
  tiktok: "tiktok",
  discord: "discord",
  accent: "accent",
};

export async function upsertProfile(
  creatorAddress: string,
  owner: string,
  profile: ProfileView
): Promise<void> {
  const params: unknown[] = [creatorAddress, owner];
  const columns = PROFILE_FIELDS.map((column) => {
    params.push(profile[PROFILE_KEYS[column]] ?? null);
    return column;
  });

  await query(
    `insert into creator_profiles (creator_address, owner, ${columns.join(", ")})
     values ($1, $2, ${columns.map((_, index) => `$${index + 3}`).join(", ")})
     on conflict (creator_address) do update set
       owner = excluded.owner,
       ${columns.map((column) => `${column} = excluded.${column}`).join(",\n       ")},
       updated_at = now()`,
    params
  );
}

export async function upsertOverlaySettings(
  creatorAddress: string,
  owner: string,
  settings: OverlaySettingsView
): Promise<void> {
  await sql`
    insert into overlay_settings (
      creator_address, owner, accent, alert_duration_ms, min_amount,
      sound_enabled, sound_url, tts_enabled, tts_voice, tts_rate,
      show_bar, pinned_goal_index, alert_heading
    ) values (
      ${creatorAddress}, ${owner}, ${settings.accent},
      ${settings.alertDurationMs}, ${settings.minAmount},
      ${settings.soundEnabled}, ${settings.soundUrl},
      ${settings.ttsEnabled}, ${settings.ttsVoice}, ${settings.ttsRate},
      ${settings.showBar}, ${settings.pinnedGoalIndex}, ${settings.alertHeading}
    )
    on conflict (creator_address) do update set
      owner             = excluded.owner,
      accent            = excluded.accent,
      alert_duration_ms = excluded.alert_duration_ms,
      min_amount        = excluded.min_amount,
      sound_enabled     = excluded.sound_enabled,
      sound_url         = excluded.sound_url,
      tts_enabled       = excluded.tts_enabled,
      tts_voice         = excluded.tts_voice,
      tts_rate          = excluded.tts_rate,
      show_bar          = excluded.show_bar,
      pinned_goal_index = excluded.pinned_goal_index,
      alert_heading     = excluded.alert_heading,
      updated_at        = now()
  `;
}

// ---------------------------------------------------------------------------
// Sign-in challenges
// ---------------------------------------------------------------------------

const NONCE_TTL_MINUTES = 5;

export async function createNonce(nonce: string): Promise<void> {
  // `make_interval` rather than `interval '5 minutes'`: interpolations here
  // become bind parameters, and a parameter cannot appear inside a string
  // literal.
  await sql`
    insert into auth_nonces (nonce, expires_at)
    values (${nonce}, now() + make_interval(mins => ${NONCE_TTL_MINUTES}))
  `;
}

/// Deletes and reports whether it existed, in one statement — two callers
/// racing on the same challenge cannot both be told it was valid.
export async function consumeNonce(nonce: string): Promise<boolean> {
  const rows: Row[] = await sql`
    delete from auth_nonces
    where nonce = ${nonce} and expires_at > now()
    returning nonce
  `;
  return rows.length > 0;
}

export async function pruneExpiredNonces(): Promise<void> {
  await sql`delete from auth_nonces where expires_at < now()`;
}
