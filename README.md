# Kadi — non-custodial creator donations on Solana

> **ნაკადი** *(nakadi)* — "stream, flow". Both a livestream and the flow of money through it.

Georgia's creators raise money through [kisa.ge](https://www.kisa.ge): **36,000+ users, 118,000+ donations, ₾1,891,000+ processed**. It takes **7.5%** of every donation (5% platform + 2.5% bank), settles over bank rails in days, and accepts **only GEL** — which locks out a diaspora that is roughly a quarter of the country.

Kadi is that product rebuilt so none of those three things are true.

|  | kisa.ge today | Kadi |
| --- | --- | --- |
| Fee | **7.5%** | **2.5%**, split atomically on-chain |
| Custody | platform holds funds | **program-derived vault**, creator-only withdrawal |
| Settlement | days, bank rails | sub-second, claim whenever |
| Donors | Georgian cards, GEL | any wallet, anywhere, or a QR scan |
| Numbers | trust the dashboard | every donation is a public transaction |

At kisa.ge's current volume, dropping 7.5% → 2.5% leaves creators roughly **₾94,000 a year** (~$35k) they currently lose to fees.

---

## Status

The program is **complete and tested** — 26 integration tests pass against a local validator, covering every instruction plus the authorization, rent-floor and accounting failure paths. The web app is **built and verified end-to-end on localnet**, indexer and wallet sign-in included.

Not yet done: a security audit, and a mainnet deployment. Do not send real money to this program yet.

---

## What's here

```
programs/kadi/          Anchor program (Rust) — the whole protocol
  src/state.rs            Config, Creator, Goal, Supporter accounts
  src/instructions/       11 instructions across config/creator/goal/donate/claim
tests/kadi.ts           26 integration tests, run against a local validator
app/                    Next.js 16 + React 19 frontend on @solana/kit v7
  src/generated/          Kit client generated from the IDL by Codama
  src/lib/db/             the read cache — connection, migrations-backed reads, writes
  src/lib/server/         indexer, wallet sign-in, share-card rendering
  migrations/             SQL, applied in order by `npm run db:migrate`
scripts/                build, type generation, and demo seeding
docs/PITCH.md           the pitch, in the framing Colosseum judges ask for
docs/GRANT-APPLICATION.md  draft application for Solana Foundation Georgia Grants
```

### Surfaces

| Route | What it does |
| --- | --- |
| `/` | Landing: protocol stats, a live donation ticker, open goals, the fee argument |
| `/explore` | Search and filter every goal — by text, category, denomination, status; sorted by trend, recency, progress or deadline. Every filter is in the URL |
| `/activity` | Global donation feed. Indexed rows below, live ones arriving on top as they confirm |
| `/c/[handle]` | Public creator page — profile, banner, socials, goals, per-denomination totals |
| `/goal/[handle]/[index]` | A goal: progress, donate widget, leaderboard, donation history with messages |
| `/dashboard` | Creator: claim a handle, edit the on-chain profile, create SOL **or USDC** goals, claim funds, mark goals done — plus analytics, page styling and overlay settings |
| `/overlay/[handle]` | Transparent OBS browser source — live alerts + goal bar, styled from the dashboard. `?test=1` adds a test-alert button, `?goal=N` pins a goal, `?bar=0` hides the bar |

| API | What it does |
| --- | --- |
| `/api/pay/[handle]/[index]` | Solana Pay transaction request endpoint (`?amount=` and `?message=` are honoured) |
| `/api/sync` | The scheduled index run. Secret-guarded; `?full=1` rewalks the whole history |
| `/api/ingest` | Write-through: a confirmed signature, indexed immediately |
| `/api/auth/*` | Sign-In With Solana — challenge, verification, session |
| `/api/creators/[handle]/{profile,overlay,analytics}` | Off-chain profile and overlay settings (owner-only writes), and per-creator totals |
| `/api/og/{goal,creator}/…` | Generated share cards, Georgian included |

Every instruction the program exposes is reachable from the UI: SOL and SPL-token
goals, donations in either, claims in either, profile edits, deadlines and goal
status changes.

### Two tiers of read

Kadi shipped with no database and the reason still holds: the ledger is the only
thing that decides anything. What it could not do was scale a landing page, a
search or a sitemap, because each meant a `getProgramAccounts` scan from the
visitor's browser — the call hosted RPC providers throttle hardest. The site got
slower the more successful the protocol became.

So there are now two tiers, and which one answers depends on what the answer is
for:

- **Discovery** — the landing page, `/explore`, `/activity`, leaderboards,
  analytics, the sitemap — reads Postgres. Every row is a projection of a
  transaction that already happened, and the whole database can be dropped and
  rebuilt by replaying signatures.
- **Money** — the goal page, the donate widget's fee quote, the claimable
  balance, and every authorisation check — reads the chain. The cache gets the
  page on screen; the chain makes it true before anyone acts on it.

Two paths fill the cache and they are allowed to overlap. `/api/sync` sweeps on a
cron; `/api/ingest` is called by the browser the instant a donation confirms, so
a donor sees their own name on the leaderboard rather than waiting for the next
tick. Donations are keyed by `(signature, event_index)` and inserted with
`on conflict do nothing`, so the two racing on one transaction costs one row.

**Without `DATABASE_URL` the app still runs.** Every page falls back to the RPC
calls it used before; only the global activity feed, which would need a full
history walk per request, says so instead.

### Denominations

A goal is either native SOL or any SPL token. Creators pick at creation; a
stablecoin goal keeps the target fixed in dollar terms rather than moving with
the SOL price. `NEXT_PUBLIC_USDC_MINT` selects which stablecoin is offered —
devnet and mainnet default to Circle's USDC, and localnet uses the stand-in mint
that `npm run seed` creates.

Solana Pay QR donations are SOL-only: the request cannot create a donor's
associated token account on their behalf, so the endpoint returns a readable 409
for token goals and the UI steers those donors to a connected wallet.

---

## Design decisions worth knowing

**The database is a cache and never a source of truth.** A creator PDA is seeded by the *handle itself*, so `/c/nikoloz_live` still resolves to an address with no index to maintain, and handle uniqueness is still enforced by the runtime rather than by a table constraint. Nothing in Postgres decides anything — it is rebuildable from the ledger, so there are deliberately no foreign keys between the mirrored tables: an ingest must never hard-fail because two accounts arrived out of order, and a cache that refuses writes to protect its own integrity is worse than one that is briefly incomplete.

**Off-chain data is only ever presentation.** Banners, avatars, socials, categories and overlay styling live in Postgres because paying rent to make a hex colour immutable would be silly. The test for whether something may live there is simple: losing the whole table must cost a creator some styling and never a lamport. Names, bios, goals, amounts and ownership are all on the chain.

**The `Config` account holds no counters.** A global account that every donation had to write to would serialize the entire protocol behind one write lock. Aggregate stats are derived by the indexer instead.

**Donation messages live in events, not accounts.** Anchor's `emit!` writes them into the transaction log: permanent, free to read over RPC, zero rent, and nothing unmoderatable sitting in an account forever. The OBS overlay subscribes to those logs directly — the alert path has no webhook, no poll and no database in it, and the index is downstream of the same feed rather than in front of it.

**Sign-in proves a keypair and nothing more.** Editing an off-chain record needs a session, so the wallet signs a human-readable message and the server checks the signature over the exact bytes the wallet displayed. The challenge is redeemed before the signature is verified, so a captured message cannot be replayed. Ownership of a handle is then checked against the creator account *on chain*, not against the mirrored row — a cache is the wrong thing to make an access decision on.

**Claimable balance is read from the vault, not a counter.** `claim_sol` computes what is available from the vault's actual lamports minus the rent-exempt floor, so accounting drift is impossible, and an active goal's vault can never be closed out from under it.

**The fee has an on-chain ceiling.** `MAX_FEE_BPS = 1000` is enforced in both `initialize` and `update_config`, so the protocol authority can lower the fee but can never raise it past 10%. Creators are not exposed to a governance rug.

**One account per unique donor, not per donation.** A `Supporter` PDA seeded by `(goal, donor)` accumulates, giving on-chain leaderboards with bounded growth.

---

## Quickstart

Prerequisites: Rust, Node 20+, the [Solana CLI](https://docs.anza.xyz/cli/install) and Anchor 0.32.1 via `avm`.

```bash
npm install && npm --prefix app install
```

Build the program, start a validator, deploy and seed demo data — one command:

```bash
npm run localnet:up
```

Then run the app:

```bash
cp app/.env.local.example app/.env.local
npm --prefix app run dev
```

That gives you three creators, five goals (four SOL, one USDC) and a dozen
donations to click through. `npm run localnet:down` stops the validator.

> **Ledger retention on localnet.** `solana-test-validator` keeps 10,000 shreds
> by default — roughly forty minutes of an idle validator's slots. Once those are
> purged, `getSignaturesForAddress` returns nothing and the donation ledger looks
> empty even though the accounts are all still there, which is a confusing thing
> to debug. `localnet-up.sh` raises the limit so a working session survives.
> Donations already indexed are unaffected: Postgres keeps what the RPC forgets,
> which is the same property that makes the cache worth having in production.

### Adding the read cache

Optional — the app runs without it. To have discovery, search and analytics
served from an index instead of an RPC scan, point `DATABASE_URL` at a Postgres
and fill it:

```bash
npm --prefix app run db:migrate
curl http://localhost:3210/api/sync
```

For anything shared, that URL should be a [Neon](https://neon.tech) connection
string; the driver switches to Neon's HTTP transport on its own when the host is
a `*.neon.tech` one, so a cold serverless invocation answers without waiting on
a TCP handshake. Any Postgres works for development — the same code path, over a
pooled socket.

Two more variables matter once the cache is on. `AUTH_SECRET` signs the session
cookie for off-chain edits. `INDEXER_SECRET` — or `CRON_SECRET`, either name,
either value accepted — guards `/api/sync`; on Vercel use `CRON_SECRET`, since
that is the variable the platform builds its scheduler's `Authorization` header
from. Without one, `/api/sync` refuses every caller in production, so the index
stops updating rather than the endpoint becoming public. `app/vercel.json`
already schedules the sweep every five minutes.

`SOLANA_RPC_URL` — no `NEXT_PUBLIC_` prefix — is the endpoint the *server* uses.
The indexer is the only thing making the throttled calls now, so this is where a
Helius or Triton key belongs, and it never reaches the browser.

Run the tests:

```bash
npm test
```

The seed is idempotent — re-running it never duplicates or corrupts anything.
Goal PDAs are derived from the creator's own counter, so goals are matched by
title against what is already on-chain rather than by a positional index.

### Watching the overlay fire

Open `http://localhost:3000/overlay/nikoloz_live`, then in another terminal:

```bash
npm run seed -- --donate
```

The alert appears the moment the donation confirms — that path is a live RPC log subscription, not polling. Add `?test=1` to the overlay URL for a button that fires a synthetic alert, so you can position the browser source in OBS without waiting for a real donation.

Colour, duration, alert heading, a minimum amount, a sound and text-to-speech are
all set from the dashboard and picked up by the source without touching the URL
in OBS. The old query parameters still override them, so a link that worked
before still works.

The overlay is also the protocol's most reliable indexer client. It runs for the
length of a broadcast, which makes it the thing most likely to be watching when a
Solana Pay QR donation lands with no browser of its own to report it.

### Deploying to devnet

```bash
npm run devnet:deploy
```

This needs roughly 4 SOL of devnet SOL. Be warned that the CLI faucet
(`solana airdrop 2 --url devnet`) is aggressively rate-limited and frequently
dry; https://faucet.solana.com is the reliable route but requires a GitHub
sign-in. The script checks your balance first and tells you what to do rather
than failing halfway through a deploy.

Afterwards, point `app/.env.local` at devnet — the script prints the exact
values. `getProgramAccounts` is now called by the indexer rather than by every
visitor, so a public RPC is survivable; set `SOLANA_RPC_URL` to a Helius or
Triton endpoint anyway, since that one process makes all the expensive calls.

### Toolchain note

`npm run build:program` is not just `anchor build`. The Solana CLI currently ships platform-tools v1.48, whose bundled rustc is 1.84 — too old for the `edition2024` manifests several transitive Solana dependencies now use. The build script pins platform-tools v1.54 via `--tools-version`, and because that flag is only understood by `cargo-build-sbf` (not by the host-side cargo Anchor uses to extract the IDL), the SBF build and the IDL build run as separate steps. `scripts/build-program.sh` handles all of it.

---

## Testing

```
26 passing (8s)
```

Coverage includes the paths that actually matter:

- fee split lands in the treasury and the vault atomically, to the lamport
- a repeat donor accumulates without inflating `supporter_count`
- leaderboards rebuild correctly from supporter accounts
- claiming never breaks the rent-exempt floor, and never rewinds the progress bar
- **rejected:** claims by a non-owner, claims above the balance, donations routed to a substituted treasury, donations to an archived goal, fees above the ceiling, config updates from a non-authority, invalid handles, duplicate handles, deadlines in the past, SOL sent to a token goal

Beyond the suite, the deployed protocol was cross-checked on localnet: every vault balance equals `raised − fee − claimed + rent floor` exactly, and the treasury holds precisely 2.5% of gross across all goals.

---

## Roadmap

Shipped: SOL and SPL-token goals, escrow vaults, instant claim in either
denomination, deadlines, leaderboards, profile editing, OBS overlay with live
alerts, and Solana Pay. Since then: a cached indexer with write-through, search
and a global activity feed, wallet sign-in, off-chain creator profiles,
configurable overlays with TTS, creator analytics, generated share cards, and
Georgian throughout.

Next, in order of how much they matter to actual adoption:

1. **Fiat on-ramp** (card → USDC). The real unlock for kisa.ge's existing users; needs KYC/business onboarding, so it is a post-funding milestone rather than a weekend's work.
2. **Embedded wallets** via email login, so a non-crypto donor never sees a seed phrase.
3. **Image uploads** rather than pasted URLs for avatars and banners — the last place the dashboard asks a creator to go find a link somewhere else.
4. **Subscriptions**, so support can be recurring rather than one-off.
5. **Security audit** before any mainnet deployment.

---

## License

MIT.
