-- Kadi's read cache.
--
-- Nothing in here is authoritative. Every row is a projection of what the
-- Solana program already decided, rebuildable from an empty database by
-- replaying the ledger, and every page that reads it can fall back to the
-- chain. That is why there are no foreign keys between the mirrored tables:
-- an ingest must never hard-fail because two accounts arrived out of order,
-- and a cache that refuses writes to protect its own integrity is worse than
-- one that is briefly incomplete.

-- Substring search over titles, handles and display names — including
-- Georgian, which Postgres has no text-search configuration for. Trigrams do
-- not care about language, and they index ILIKE '%…%' properly.
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Indexer bookkeeping
-- ---------------------------------------------------------------------------

create table if not exists indexer_state (
    id              text primary key,
    last_signature  text,
    last_slot       bigint,
    donations_seen  bigint      not null default 0,
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Chain mirror
-- ---------------------------------------------------------------------------

create table if not exists creators (
    address       text primary key,
    owner         text        not null,
    handle        text        not null unique,
    display_name  text        not null default '',
    bio           text        not null default '',
    avatar_uri    text        not null default '',
    goal_count    integer     not null default 0,
    created_at    timestamptz,
    synced_at     timestamptz not null default now()
);

create index if not exists creators_owner_idx on creators (owner);
create index if not exists creators_handle_trgm_idx on creators using gin (handle gin_trgm_ops);
create index if not exists creators_display_name_trgm_idx on creators using gin (display_name gin_trgm_ops);

create table if not exists goals (
    address          text primary key,
    creator_address  text          not null,
    goal_index       integer       not null,
    title            text          not null default '',
    description      text          not null default '',
    mint             text          not null,
    -- u64 base units. numeric(39,0) holds every u64 exactly; a double would
    -- start rounding lamport amounts above ~9 million SOL.
    target           numeric(39,0) not null default 0,
    raised           numeric(39,0) not null default 0,
    claimed          numeric(39,0) not null default 0,
    donation_count   bigint        not null default 0,
    supporter_count  integer       not null default 0,
    status           smallint      not null default 0,
    deadline         timestamptz,
    created_at       timestamptz,
    synced_at        timestamptz   not null default now(),
    unique (creator_address, goal_index)
);

create index if not exists goals_creator_idx on goals (creator_address);
create index if not exists goals_status_created_idx on goals (status, created_at desc);
create index if not exists goals_mint_idx on goals (mint);
create index if not exists goals_title_trgm_idx on goals using gin (title gin_trgm_ops);
create index if not exists goals_description_trgm_idx on goals using gin (description gin_trgm_ops);

-- One row per donation event, not per transaction: a single transaction may
-- carry more than one `emit!`, so the event's position in the log is part of
-- the key. Re-ingesting a signature is therefore a no-op rather than a
-- duplicate.
create table if not exists donations (
    signature        text          not null,
    event_index      smallint      not null default 0,
    goal_address     text          not null,
    creator_address  text          not null,
    donor            text          not null,
    mint             text          not null,
    amount           numeric(39,0) not null,
    net              numeric(39,0) not null,
    fee              numeric(39,0) not null,
    message          text          not null default '',
    raised_after     numeric(39,0) not null default 0,
    target_at_time   numeric(39,0) not null default 0,
    is_first_time    boolean       not null default false,
    block_time       timestamptz   not null,
    slot             bigint,
    indexed_at       timestamptz   not null default now(),
    primary key (signature, event_index)
);

create index if not exists donations_goal_time_idx on donations (goal_address, block_time desc);
create index if not exists donations_creator_time_idx on donations (creator_address, block_time desc);
create index if not exists donations_time_idx on donations (block_time desc);
create index if not exists donations_donor_idx on donations (donor);

-- ---------------------------------------------------------------------------
-- Off-chain, creator-owned
--
-- Everything here is presentation that would be wasteful to pay rent for and
-- pointless to make immutable. Losing it costs a creator some styling; it can
-- never cost anyone money, and no donation depends on it.
-- ---------------------------------------------------------------------------

create table if not exists creator_profiles (
    creator_address text primary key,
    owner           text        not null,
    banner_url      text,
    avatar_url      text,
    about           text,
    category        text,
    location        text,
    website         text,
    twitter         text,
    youtube         text,
    twitch          text,
    instagram       text,
    tiktok          text,
    discord         text,
    accent          text,
    updated_at      timestamptz not null default now()
);

create index if not exists creator_profiles_category_idx on creator_profiles (category);

create table if not exists overlay_settings (
    creator_address     text primary key,
    owner               text          not null,
    accent              text          not null default '#c63d2f',
    alert_duration_ms   integer       not null default 5200,
    -- Base units of the goal's own denomination. Alerts below it still land in
    -- the ledger; they just do not interrupt the stream.
    min_amount          numeric(39,0) not null default 0,
    sound_enabled       boolean       not null default false,
    sound_url           text,
    tts_enabled         boolean       not null default false,
    tts_voice           text,
    tts_rate            numeric(4,2)  not null default 1.0,
    show_bar            boolean       not null default true,
    pinned_goal_index   integer,
    alert_heading       text,
    updated_at          timestamptz   not null default now()
);

-- Single-use challenges for wallet sign-in. Rows are deleted on redemption and
-- swept on expiry, so this table stays near-empty.
create table if not exists auth_nonces (
    nonce      text primary key,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
);

create index if not exists auth_nonces_expiry_idx on auth_nonces (expires_at);
