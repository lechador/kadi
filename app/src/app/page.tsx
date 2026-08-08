"use client";

import Link from "next/link";

import { ChainError } from "@/components/ChainError";
import { GoalCard } from "@/components/GoalCard";
import { Nav } from "@/components/Nav";
import { GoalStatus } from "@/generated";
import { INCUMBENT_FEE_BPS } from "@/lib/config";
import { formatSol } from "@/lib/format";
import { useAsync, useKadiClient } from "@/lib/hooks";
import { fetchAllGoals, fetchConfig, summarise } from "@/lib/queries";
import type { KadiRpc } from "@/lib/queries";

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-t border-black/20 py-4">
      <p className="eyebrow text-mist-500">{label}</p>
      <p className="font-mono text-xl font-bold tracking-tight text-mist-100">
        {value}
      </p>
    </div>
  );
}

export default function LandingPage() {
  const client = useKadiClient();

  const goals = useAsync(
    () => fetchAllGoals(client.rpc as unknown as KadiRpc),
    [client]
  );
  const config = useAsync(() => fetchConfig(client.rpc), [client]);

  const stats = goals.data ? summarise(goals.data) : null;
  const feeBps = config.data?.feeBps ?? 250;
  const active = (goals.data ?? []).filter(
    (goal) => goal.data.status === GoalStatus.Active
  );

  return (
    <>
      <Nav />

      <main>
        <section className="border-b border-black/20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex items-center justify-between border-b border-black/20 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-mist-500">
              <span>Creator funding / Georgia → anywhere</span>
              <span className="hidden items-center gap-2 sm:flex">
                <span className="h-2 w-2 bg-mint-400" /> Live on Solana
              </span>
            </div>

            <div className="grid min-h-[40rem] lg:grid-cols-[1.45fr_0.75fr]">
              <div className="flex flex-col justify-between py-12 pr-0 sm:py-16 lg:border-r lg:border-black/20 lg:pr-12">
                <div>
                  <p className="eyebrow mb-7 text-grape-400">Kadi / ნაკადი</p>
                  <h1 className="display max-w-5xl text-[clamp(4.1rem,9vw,8.5rem)] leading-[0.82]">
                    Keep what your audience gives.
                  </h1>
                </div>

                <div className="mt-12 grid items-end gap-8 border-t border-black/20 pt-6 sm:grid-cols-[1fr_auto]">
                  <p className="max-w-xl text-base leading-relaxed text-mist-500 sm:text-lg">
                    Direct creator support without the waiting room. Donations
                    settle in seconds, live in a creator-controlled vault, and
                    leave a public receipt on-chain.
                  </p>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Link
                      href="/dashboard"
                      className="btn-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
                    >
                      Open your page
                    </Link>
                    <a
                      href="#goals"
                      className="btn-secondary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
                    >
                      Browse goals
                    </a>
                  </div>
                </div>
              </div>

              <aside className="flex flex-col justify-end py-10 lg:pl-10">
                <div className="border border-black/30 bg-ink-850">
                  <div className="bg-grape-400 px-5 py-6 text-white">
                    <p className="eyebrow opacity-80">Fee comparison</p>
                    <p className="mt-4 font-mono text-[clamp(2.7rem,5vw,4.6rem)] font-bold leading-none tracking-[-0.08em]">
                      {(INCUMBENT_FEE_BPS / 100).toFixed(1)}% → {(feeBps / 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dashed border-black/30 py-4 text-sm">
                      <span className="text-mist-500">Typical platform</span>
                      <span className="font-mono line-through decoration-grape-400 decoration-2">
                        92.5% kept
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dashed border-black/30 py-4 text-sm">
                      <span className="text-mist-500">With Kadi</span>
                      <span className="font-mono font-bold text-mint-500">
                        97.5% kept
                      </span>
                    </div>
                    <div className="mt-5 flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
                      <span>No payout queue</span>
                      <span>No custody</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="border-b border-black/20 bg-ink-850">
          <div className="mx-auto grid max-w-7xl px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <div className="py-8 sm:pr-6 lg:border-r lg:border-black/20">
              <StatLine
                label="Raised"
                value={stats ? `${formatSol(stats.totalRaised, 2)} SOL` : "—"}
              />
            </div>
            <div className="py-8 sm:pl-6 lg:border-r lg:border-black/20 lg:pr-6">
              <StatLine
                label="Donations"
                value={stats ? stats.donationCount.toString() : "—"}
              />
            </div>
            <div className="py-8 sm:pr-6 lg:pl-6 lg:border-r lg:border-black/20">
              <StatLine
                label="Creators"
                value={stats ? stats.creatorCount.toString() : "—"}
              />
            </div>
            <div className="py-8 sm:pl-6">
              <StatLine
                label="Open goals"
                value={stats ? stats.goalCount.toString() : "—"}
              />
            </div>
          </div>
          <p className="mx-auto max-w-7xl border-t border-black/20 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600 sm:px-8">
            Live ledger values. No analytics database, no private counter.
          </p>
        </section>

        <section id="goals" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mb-9 grid gap-4 border-t border-black pt-5 md:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-grape-400">Open now / 01</p>
            <div>
              <h2 className="display text-5xl leading-none sm:text-6xl">Fund something real.</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-500">
                Pick a goal, leave a message, and watch the transfer land. Every
                amount below comes directly from the chain.
              </p>
            </div>
          </div>

          {goals.loading && (
            <div className="grid gap-px bg-black/20 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className="h-60 animate-pulse bg-ink-850" />
              ))}
            </div>
          )}

          {goals.error && (
            <ChainError error={goals.error} onRetry={goals.reload} />
          )}

          {!goals.loading && !goals.error && active.length === 0 && (
            <div className="border-y border-black/20 py-14">
              <p className="display text-3xl">The first page is still blank.</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.08em] text-grape-400 hover:underline"
              >
                Create the first goal →
              </Link>
            </div>
          )}

          <div className="grid gap-px bg-black/20 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((goal) => (
              <GoalCardWithHandle key={goal.address} goal={goal} />
            ))}
          </div>
        </section>

        <section className="border-y border-black/20 bg-mist-100 text-ink-950">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
              <div>
                <p className="eyebrow text-grape-400">The terms / 02</p>
                <p className="display mt-6 text-5xl leading-[0.92] sm:text-6xl">
                  No small print hiding backstage.
                </p>
              </div>
              <div className="grid gap-px bg-white/20 sm:grid-cols-3">
                {[
                  ["01", "Creator-controlled", "Funds sit in a program vault only the creator can withdraw from."],
                  ["02", "Stream-ready", "One OBS browser source turns ledger events into live donation alerts."],
                  ["03", "Global by default", "A wallet or QR scan works across borders without an international card."],
                ].map(([number, title, body]) => (
                  <article key={number} className="bg-mist-100 p-6 sm:min-h-64">
                    <p className="font-mono text-[10px] text-grape-400">№ {number}</p>
                    <h3 className="display mt-12 text-2xl">{title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink-700">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-end">
          <div>
            <p className="eyebrow text-grape-400">For creators</p>
            <h2 className="display mt-4 max-w-3xl text-5xl leading-[0.95] sm:text-7xl">
              Your audience is already there.
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="btn-primary shrink-0 px-6 py-4 text-xs font-bold uppercase tracking-[0.08em]"
          >
            Claim your handle →
          </Link>
        </section>
      </main>

      <footer className="border-t border-black/20 bg-ink-850">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 px-5 py-7 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600 sm:flex-row sm:px-8">
          <span>Kadi — ნაკადი</span>
          <span>Open source / non-custodial / built on Solana</span>
        </div>
      </footer>
    </>
  );
}

function GoalCardWithHandle({
  goal,
}: {
  goal: { address: string; data: import("@/generated").Goal };
}) {
  const client = useKadiClient();
  const creator = useAsync(async () => {
    const { fetchMaybeCreator } = await import("@/generated");
    const account = await fetchMaybeCreator(
      client.rpc as never,
      goal.data.creator
    );
    return account.exists ? account.data.handle : null;
  }, [client, goal.data.creator]);

  if (!creator.data) {
    return <div className="h-60 animate-pulse bg-ink-850" />;
  }
  return <GoalCard goal={goal.data} handle={creator.data} showCreator />;
}
