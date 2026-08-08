"use client";

import Link from "next/link";

import { GoalCard } from "@/components/GoalCard";
import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import { INCUMBENT_FEE_BPS } from "@/lib/config";
import { formatSol } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import type { DonationView, GoalView, StatsView } from "@/lib/views";
import { LiveTicker } from "./LiveTicker";

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end justify-between gap-4 border-t border-rule py-4">
      <p className="eyebrow text-mist-500">{label}</p>
      <p className="font-mono text-xl font-bold tracking-tight text-mist-100">
        {value}
      </p>
    </div>
  );
}

export function LandingView({
  stats,
  goals,
  recent,
  feeBps,
  source,
}: {
  stats: StatsView;
  goals: GoalView[];
  recent: DonationView[];
  feeBps: number;
  source: "db" | "chain";
}) {
  const { t } = useLanguage();

  return (
    <>
      <Nav />

      <main>
        <section className="border-b border-rule">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex items-center justify-between border-b border-rule py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-mist-500">
              <span>{t("creatorFunding")}</span>
              <span className="hidden items-center gap-2 sm:flex">
                <span className="h-2 w-2 bg-mint-400" /> {t("liveOnSolana")}
              </span>
            </div>

            <div className="grid min-h-[40rem] lg:grid-cols-[1.45fr_0.75fr]">
              <div className="flex flex-col justify-between py-12 pr-0 sm:py-16 lg:border-r lg:border-rule lg:pr-12">
                <div>
                  <p className="eyebrow mb-7 text-grape-400">Kadi / ნაკადი</p>
                  <h1 className="display max-w-5xl text-[clamp(4.1rem,9vw,8.5rem)] leading-[0.82]">
                    {t("heroTitle")}
                  </h1>
                </div>

                <div className="mt-12 grid items-end gap-8 border-t border-rule pt-6 sm:grid-cols-[1fr_auto]">
                  <p className="max-w-xl text-base leading-relaxed text-mist-500 sm:text-lg">
                    {t("heroBody")}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Link
                      href="/dashboard"
                      className="btn-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
                    >
                      {t("openYourPage")}
                    </Link>
                    <Link
                      href="/explore"
                      className="btn-secondary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
                    >
                      {t("browseGoals")}
                    </Link>
                  </div>
                </div>
              </div>

              <aside className="flex flex-col justify-end py-10 lg:pl-10">
                <div className="border border-rule-strong bg-ink-850 shadow-[0_0_60px_-24px_var(--accent)]">
                  {/* grape-600, not the brighter step: white on the neon violet
                      measures 2.8:1. The deep fill reads as the same colour and
                      clears 6.2:1. */}
                  <div className="bg-grape-600 px-5 py-6 text-white">
                    <p className="eyebrow opacity-80">{t("feeComparison")}</p>
                    <p className="mt-4 font-mono text-[clamp(2.7rem,5vw,4.6rem)] font-bold leading-none tracking-[-0.08em]">
                      {(INCUMBENT_FEE_BPS / 100).toFixed(1)}% →{" "}
                      {(feeBps / 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dashed border-rule-strong py-4 text-sm">
                      <span className="text-mist-500">{t("typicalPlatform")}</span>
                      <span className="font-mono line-through decoration-grape-400 decoration-2">
                        {t("kept925")}
                      </span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-dashed border-rule-strong py-4 text-sm">
                      <span className="text-mist-500">{t("withKadi")}</span>
                      <span className="font-mono font-bold text-mint-500">
                        {t("kept975")}
                      </span>
                    </div>
                    <div className="mt-5 flex justify-between font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
                      <span>{t("noPayoutQueue")}</span>
                      <span>{t("noCustody")}</span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </section>

        <section className="border-b border-rule bg-ink-850">
          <div className="mx-auto grid max-w-7xl px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            <div className="py-8 sm:pr-6 lg:border-r lg:border-rule">
              <StatLine
                label={t("raised")}
                value={`${formatSol(BigInt(stats.totalRaised), 2)} SOL`}
              />
            </div>
            <div className="py-8 sm:pl-6 lg:border-r lg:border-rule lg:pr-6">
              <StatLine
                label={t("donations")}
                value={stats.donationCount.toLocaleString()}
              />
            </div>
            <div className="py-8 sm:pr-6 lg:pl-6 lg:border-r lg:border-rule">
              <StatLine
                label={t("creators")}
                value={stats.creatorCount.toLocaleString()}
              />
            </div>
            <div className="py-8 sm:pl-6">
              <StatLine
                label={t("openGoals")}
                value={stats.activeGoalCount.toLocaleString()}
              />
            </div>
          </div>
          <p className="mx-auto max-w-7xl border-t border-rule px-5 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600 sm:px-8">
            {source === "db" ? t("liveLedgerCached") : t("liveLedger")}
          </p>
        </section>

        {recent.length > 0 && <LiveTicker initial={recent} />}

        <section id="goals" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="mb-9 grid gap-4 border-t border-rule-solid pt-5 md:grid-cols-[1fr_2fr]">
            <p className="eyebrow text-grape-400">{t("openNow")}</p>
            <div>
              <h2 className="display text-5xl leading-none sm:text-6xl">
                {t("fundReal")}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist-500">
                {t("fundRealBody")}
              </p>
            </div>
          </div>

          {goals.length === 0 ? (
            <div className="border-y border-rule py-14">
              <p className="display text-3xl">{t("firstPageBlank")}</p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block text-xs font-bold uppercase tracking-[0.08em] text-grape-400 hover:underline"
              >
                {t("createFirstGoal")}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
                {goals.map((goal) => (
                  <GoalCard key={goal.address} goal={goal} showCreator />
                ))}
              </div>
              <Link
                href="/explore"
                className="btn-secondary mt-8 inline-block px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
              >
                {t("seeAllGoals")}
              </Link>
            </>
          )}
        </section>

        {/* The light theme inverted this block to white. On a near-black page
            that reads as a hole punched through it, so it is an accent-tinted
            panel instead — the one large field of colour on the site. */}
        <section className="panel-accent">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
              <div>
                <p className="eyebrow text-grape-400">{t("terms")}</p>
                <p className="display glow-text mt-6 text-5xl leading-[0.92] text-mist-100 sm:text-6xl">
                  {t("noSmallPrint")}
                </p>
              </div>
              <div className="grid gap-px bg-rule sm:grid-cols-3">
                {[
                  ["01", t("creatorControlled"), t("creatorControlledBody")],
                  ["02", t("streamReady"), t("streamReadyBody")],
                  ["03", t("globalDefault"), t("globalDefaultBody")],
                ].map(([number, title, body]) => (
                  <article key={number} className="bg-ink-850 p-6 sm:min-h-64">
                    <p className="font-mono text-[10px] text-grape-400">
                      № {number}
                    </p>
                    <h3 className="display mt-12 text-2xl text-mist-100">
                      {title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-mist-500">
                      {body}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-end">
          <div>
            <p className="eyebrow text-grape-400">{t("forCreators")}</p>
            <h2 className="display mt-4 max-w-3xl text-5xl leading-[0.95] sm:text-7xl">
              {t("audienceThere")}
            </h2>
          </div>
          <Link
            href="/dashboard"
            className="btn-primary shrink-0 px-6 py-4 text-xs font-bold uppercase tracking-[0.08em]"
          >
            {t("claimHandleArrow")}
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
