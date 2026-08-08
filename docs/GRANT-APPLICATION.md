# Grant application — draft

**Target:** [Solana Foundation Georgia Grants](https://superteam.fun/earn/grants/solana-foundation-georgia-grants) via Superteam Earn
**Amount:** up to $10k USDG · average approved grant $7,857 · typical response ~1 week
**Eligibility:** regional grant, open only to applicants in Georgia ✅

> Fill in the bracketed fields before submitting. Everything else is drawn from the working repository.

---

## Project name

**Kadi** — ნაკადი, "stream/flow". Non-custodial creator donations on Solana.

## One-line description

Georgia's creator-donation platform, rebuilt on Solana so creators keep 5% more of every donation and supporters abroad can actually send one.

## What are you building, and why does it need to exist?

Georgia's creator economy runs on [kisa.ge](https://www.kisa.ge) — by its own published figures, **36,000+ users, 118,000+ donations, ₾1,891,000+ processed**. It charges **7.5%** (5% platform + 2.5% bank), accepts **only GEL by Georgian card**, and settles over banking rails.

Two of those three constraints are not product decisions — they are properties of the payment rail. That is why this is a Solana project rather than a better web app:

1. **The fee.** 2.5% of the 7.5% is the card processor itself. On Solana the equivalent cost is a fraction of a cent, so Kadi charges **2.5% total** and splits it atomically in the donation transaction. At the incumbent's current volume that leaves roughly **₾94,000 a year** with creators instead of intermediaries.
2. **The diaspora.** Roughly a quarter of Georgians live abroad, and they are the people most motivated to support creators back home — but a Georgian card checkout in GEL is exactly what they cannot use. A wallet or a Solana Pay QR scan works from anywhere.
3. **Custody.** Donations land in a program-derived vault only the creator can withdraw from. The platform is structurally incapable of holding creator funds.

## What have you built so far?

A complete, tested protocol and web application — not a prototype.

**On-chain (Anchor 0.32, Rust):** 11 instructions covering protocol config, creator registration, goal creation in SOL *or* any SPL token, donations with an atomic fee split, escrow claim, and goal status. **26 integration tests pass** against a local validator, including every authorization, rent-floor and accounting failure path.

**Frontend (Next.js 16, React 19, `@solana/kit` v7):** public creator pages, goal pages with on-chain leaderboards and donation history, a creator dashboard with fund claiming, a transparent **OBS overlay** driven by a live RPC log subscription, and a **Solana Pay** transaction-request endpoint.

**Notable engineering choices:**
- **No database.** Creator lookup, goal lists, leaderboards and the live alert feed all read from chain. Creator PDAs are seeded by the handle itself, so handle uniqueness is enforced by the runtime and `/c/<handle>` needs no index.
- **Donation messages live in Anchor events**, not accounts — permanent in the ledger, zero rent, and the OBS overlay subscribes to those logs directly with no webhook or backend in between.
- **The fee ceiling is enforced on-chain** at 10%, so the authority can lower the fee but can never raise it past that. For a product whose pitch is "we take less," that guarantee should be in the program, not the terms of service.
- **Claimable balance is read from the vault's real lamports**, not a running counter, so accounting drift is impossible.

Verified on localnet rather than assumed: every vault balance equals `raised − fee − claimed + rent floor` exactly, and the treasury holds precisely 2.5% of gross across all goals.

**Repository:** [ADD PUBLIC REPO URL]
**Demo video:** [ADD 2-MINUTE WALKTHROUGH]

## What will the grant fund?

| Milestone | Deliverable | Estimate |
| --- | --- | --- |
| 1. Fiat on-ramp | Card → USDC via a licensed provider, so kisa.ge's existing non-crypto donors can use Kadi unchanged. Includes KYC/business onboarding. | $3,500 |
| 2. Embedded wallets | Email/Google sign-in with an auto-provisioned wallet — a donor never sees a seed phrase. | $2,000 |
| 3. Security audit | Independent review of the program before any mainnet deployment. | $2,500 |
| 4. Feature parity + localisation | TTS donation alerts and full Georgian UI, the last gaps against the incumbent. | $1,000 |
| 5. Creator onboarding | Direct recruitment and support of the first 10 Georgian creators. | $1,000 |
| **Total** | | **$10,000** |

Milestone 3 gates mainnet: no real money moves through the program until it has been audited.

## Success metrics (6 months from funding)

- 10 Georgian creators actively receiving donations
- 500 donations settled on mainnet
- ≥25% of donation volume originating outside Georgia — the diaspora thesis, tested
- Verifiable on-chain total of fees *not* charged versus the 7.5% baseline

Every one of these is publicly auditable on-chain, which is the point.

## Why this team

[ADD: your background, why you specifically can reach Georgian creators, any prior shipping history. Superteam grants weight local credibility heavily — if you have existing relationships in the Georgian streaming scene, that belongs here.]

Skills the grant page asks for and this project demonstrates: **Blockchain** (Anchor program, PDA escrow design, atomic fee splitting), **Frontend** (Next.js 16 / React 19 on Solana Kit v7), **Backend** (Solana Pay transaction requests, IDL-driven code generation).

## Risks, stated plainly

- **No users yet.** The traction section is a plan, not a result.
- **Not audited, not on mainnet.** Milestone 3 addresses this and gates everything downstream.
- **Crypto onboarding is the real risk**, not the technology. Milestones 1 and 2 exist because a Georgian donor who has never held crypto is the actual constraint on adoption, and no amount of on-chain elegance substitutes for solving it.
- **The incumbent could cut fees.** It cannot go below its ~2.5% bank cost, and it cannot serve the diaspora without changing rails. That gap is the defensible part.

## Contact

[ADD NAME] · [ADD EMAIL] · [ADD TELEGRAM/X]
