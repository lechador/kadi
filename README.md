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

The program is **complete and tested** — 26 integration tests pass against a local validator, covering every instruction plus the authorization, rent-floor and accounting failure paths. The web app is **built and verified end-to-end on localnet**.

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
scripts/                build, type generation, and demo seeding
docs/PITCH.md           the pitch, in the framing Colosseum judges ask for
docs/GRANT-APPLICATION.md  draft application for Solana Foundation Georgia Grants
```

### Surfaces

| Route | What it does |
| --- | --- |
| `/` | Landing: protocol stats read live from chain, open goals, the fee argument |
| `/c/[handle]` | Public creator page — profile, goals, per-denomination totals |
| `/goal/[handle]/[index]` | A goal: progress, donate widget, leaderboard, donation history with messages |
| `/dashboard` | Creator: claim a handle, edit the profile, create SOL **or USDC** goals with optional deadlines, claim funds, mark goals done, copy the overlay URL |
| `/overlay/[handle]` | Transparent OBS browser source — live alerts + goal bar. `?test=1` adds a test-alert button, `?goal=N` pins a goal, `?bar=0` hides the bar |
| `/api/pay/[handle]/[index]` | Solana Pay transaction request endpoint (`?amount=` and `?message=` are honoured) |

Every instruction the program exposes is reachable from the UI: SOL and SPL-token
goals, donations in either, claims in either, profile edits, deadlines and goal
status changes.

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

**No database, anywhere.** Creator lookup, goal lists, leaderboards and the alert feed all read from chain. A creator PDA is seeded by the *handle itself*, so `/c/nikoloz_live` resolves to an address with no index to maintain — and handle uniqueness is enforced by the runtime rather than by a table constraint.

**The `Config` account holds no counters.** A global account that every donation had to write to would serialize the entire protocol behind one write lock. Aggregate stats are derived client-side instead.

**Donation messages live in events, not accounts.** Anchor's `emit!` writes them into the transaction log: permanent, free to read over RPC, zero rent, and nothing unmoderatable sitting in an account forever. The OBS overlay subscribes to those logs directly — no webhook, no indexer, no backend between the chain and the stream.

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
values. Note that a public RPC will rate-limit `getProgramAccounts`, which the
landing page and leaderboards use; for anything shared, use a Helius or Triton
endpoint.

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
alerts, and Solana Pay.

Next, in order of how much they matter to actual adoption:

1. **Fiat on-ramp** (card → USDC). The real unlock for kisa.ge's existing users; needs KYC/business onboarding, so it is a post-funding milestone rather than a weekend's work.
2. **Embedded wallets** via email login, so a non-crypto donor never sees a seed phrase.
3. **TTS alerts** — kisa.ge's most-used feature after the goal bar.
4. **Georgian localisation** end to end.
5. **A cached indexer** so the landing page and leaderboards stop depending on `getProgramAccounts`, which public RPCs throttle.
6. **Security audit** before any mainnet deployment.

---

## License

MIT.
