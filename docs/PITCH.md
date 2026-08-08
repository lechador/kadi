# Kadi — pitch

*Structured around what Colosseum judges say they weight: a real problem with real users, a working MVP, a user-acquisition plan, a monetization plan, and why this team.*

---

## The problem, with numbers

Georgia has one dominant creator-donation platform: **[kisa.ge](https://www.kisa.ge)**. Its own homepage reports:

- **36,000+** users
- **118,000+** donations
- **₾1,891,000+** raised (~$700k)

It charges **7.5%** — 5% platform plus 2.5% bank. On the volume above that is roughly **₾142,000 taken out of creators' pockets**, and it compounds every year.

Three structural problems, none of which kisa.ge can fix without changing rails:

1. **The fee is a bank-rail fee.** 2.5% of it is literally the card processor. No amount of product work removes it.
2. **Donations are GEL-only, by card, through a Georgian bank page.** Georgia's diaspora is on the order of a million people — call it a quarter of the population — and they are the segment most likely to send money home. They are also the segment least able to use a Georgian card checkout.
3. **Payouts settle over banking rails**, and creators take the platform's dashboard on trust.

## The solution

Kadi is the same product — creator profile, goal with a progress bar, donate-with-a-message, OBS alert overlay — with the money moving on Solana instead of through a bank.

- **2.5% instead of 7.5%.** The fee is split in the same transaction as the donation. There is no processor to pay.
- **Nobody holds the money.** Donations land in a program-derived vault the creator alone can withdraw from. The platform *cannot* take custody; that is enforced by the program, not by policy.
- **Sub-second settlement**, claimable at any moment.
- **A donor anywhere can give** with a wallet or by scanning a Solana Pay QR — no Georgian card, no international transfer fee.
- **Every number is public.** A creator's totals are verifiable transactions, not a dashboard they have to believe.

The fee ceiling is enforced on-chain at 10%: the protocol authority can lower it but can never raise it beyond that. That matters for a product whose whole pitch is "we take less than the incumbent."

## The MVP — built, tested, working

This is not a deck. The repository contains a working protocol:

- **Anchor program**, 11 instructions: protocol config, creator registration, goal creation (SOL *and* SPL-token denominated), donations, escrow claim, status management.
- **26 integration tests** passing against a local validator, including every authorization, rent-floor and accounting failure path.
- **Next.js 16 / React 19 frontend** on `@solana/kit` v7, with the on-chain client generated from the IDL by Codama so it cannot drift from the deployed program.
- **OBS overlay** that fires alerts from a live RPC log subscription — verified end-to-end.
- **Solana Pay transaction request endpoint**, verified by signing and submitting the transaction it returns.

Verified on localnet, not merely asserted: every vault balance equals `raised − fee − claimed + rent floor` exactly, and the treasury holds precisely 2.5% of gross.

**Architecturally, there is no database.** Creator lookup, goal lists, leaderboards and the alert feed all read from chain. That is not a purity exercise — it means the trust story is real, the thing is cheap to run, and there is no backend to be the weak link.

## Market

- **Beachhead:** Georgian streamers and creators. ~36k users on the incumbent, ₾1.9M/yr of measured volume, one competitor.
- **Immediate expansion:** the Georgian diaspora as *donors* — a segment the incumbent structurally cannot serve well.
- **Adjacent:** the same shape recurs across every emerging market where a local donation platform is stapled to local card rails. Armenia, Turkey, the Balkans and Ukraine all have the same product with the same fee and the same cross-border problem.

This is deliberately not "creator monetization, globally." It is one country with a known incumbent, a known fee, and a public volume number to measure against.

## Go-to-market

The wedge is that creators do not have to switch — they can run Kadi *alongside* kisa.ge and keep both links in their bio. Nothing is lost by trying it.

1. **Recruit 10 creators by hand.** Georgia's streaming scene is small enough to reach individually. The pitch is one sentence: *the same donation, and you keep 5% more of it.*
2. **Let the overlay do the marketing.** Every alert on stream is the product demonstrating itself to an audience of exactly the right people. This is how the incumbent grew.
3. **Target the diaspora deliberately** — Georgian communities abroad, where "support someone back home without an international card" is the actual pain.
4. **Publish the numbers.** Because everything is on-chain, "creators kept ₾X that would have gone to fees" is a verifiable claim, not marketing.

## Monetization

The 2.5% protocol fee, split on-chain into a treasury at donation time. At the incumbent's current volume that is roughly **₾47,000/yr (~$17k)** — small, but it is a real revenue line from day one, it scales linearly with volume, and it is collected atomically with zero collection risk.

The honest read: Georgia alone is a business that supports a small team, not a venture outcome. The venture case is that the same rails work unchanged for every market with the same structure, and Georgia is where it can be proven with a named competitor and public numbers.

## What funding buys

1. **Fiat on-ramp** (card → USDC). The single biggest adoption blocker; needs KYC and business onboarding, which is exactly the kind of thing a grant unblocks.
2. **Embedded wallets** so a non-crypto donor never sees a seed phrase.
3. **Security audit** before mainnet.
4. **TTS alerts and full Georgian localisation** — the remaining feature gaps against the incumbent.
5. **Creator acquisition** — direct outreach to the first cohort.

## Status and honesty

- The program is complete and tested; it is **not audited** and **not on mainnet**.
- There are **no users yet**. Everything above about traction is a plan, not a result.
- The incumbent's figures are taken from its own public homepage.

## Links

- Code, tests and architecture notes: [`README.md`](../README.md)
- Grant application draft: [`GRANT-APPLICATION.md`](./GRANT-APPLICATION.md)
