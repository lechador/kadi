"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { unwrapOption, type Address } from "@solana/kit";

import { DonatePanel } from "@/components/DonatePanel";
import { Nav } from "@/components/Nav";
import { ProgressBar } from "@/components/ProgressBar";
import { SiteFooter } from "@/components/SiteFooter";
import { StatusPill } from "@/components/GoalCard";
import { SupporterList } from "@/components/SupporterList";
import { explorerTx } from "@/lib/config";
import {
  formatDeadline,
  formatTokenAmount,
  percent,
  shortAddress,
  timeAgo,
} from "@/lib/format";
import { useKadiClient, useWallet } from "@/lib/hooks";
import { useLanguage } from "@/lib/i18n";
import { useLiveDonations } from "@/lib/live";
import { fetchConfig, fetchGoalAt, type KadiRpc } from "@/lib/queries";
import { tokenFor } from "@/lib/tokens";
import type { DonationView, GoalView, SupporterView } from "@/lib/views";

/// The one page that does not trust the cache.
///
/// A donor is about to move money against the numbers on this page, so the
/// server's indexed copy is only the first paint. As soon as the page is
/// interactive it re-reads the goal account from chain, and it keeps reading it
/// whenever a donation for this goal appears on the log subscription. The cache
/// makes the page arrive; the chain makes it true.

export function GoalPageView({
  goal: initialGoal,
  creatorName,
  donations: initialDonations,
  supporters: initialSupporters,
  config: initialConfig,
}: {
  goal: GoalView;
  creatorName: string;
  donations: DonationView[];
  supporters: SupporterView[];
  config: { treasury: string; feeBps: number } | null;
}) {
  const { language, t } = useLanguage();
  const client = useKadiClient();
  const connected = useWallet();

  const [goal, setGoal] = useState(initialGoal);
  const [donations, setDonations] = useState(initialDonations);
  const [supporters, setSupporters] = useState(initialSupporters);
  const [config, setConfig] = useState(initialConfig);
  const [verified, setVerified] = useState(false);

  const token = tokenFor(goal.mint);

  /// Re-reads the goal account itself. Cheap — one `getAccountInfo` against a
  /// PDA — which is why it can run on mount and after every donation.
  const revalidate = useCallback(async () => {
    try {
      const fresh = await fetchGoalAt(
        client.rpc,
        goal.creatorAddress as Address,
        BigInt(goal.index)
      );
      if (!fresh) return;

      setGoal((current) => ({
        ...current,
        target: fresh.data.target.toString(),
        raised: fresh.data.raised.toString(),
        claimed: fresh.data.claimed.toString(),
        donationCount: Number(fresh.data.donationCount),
        supporterCount: Number(fresh.data.supporterCount),
        status: Number(fresh.data.status),
        deadline: (() => {
          const deadline = unwrapOption(fresh.data.deadline);
          return deadline === null ? null : Number(deadline);
        })(),
      }));
      setVerified(true);
    } catch {
      // The server-rendered figures stay on screen. They came from the same
      // ledger; they are just a few seconds older.
    }
  }, [client, goal.creatorAddress, goal.index]);

  useEffect(() => {
    void revalidate();
    if (config) return;
    void fetchConfig(client.rpc).then((fresh) => {
      if (fresh) setConfig({ treasury: fresh.treasury, feeBps: fresh.feeBps });
    });
  }, [client, config, revalidate]);

  /// Pulls the ledger and leaderboard back from the API, which reads the index.
  const refreshFeed = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/goals/${goal.handle}/${goal.index}/activity`
      );
      if (!response.ok) return;
      const body = (await response.json()) as {
        donations: DonationView[];
        supporters: SupporterView[];
      };
      setDonations(body.donations);
      setSupporters(body.supporters);
    } catch {
      // Leaves what is already rendered in place.
    }
  }, [goal.handle, goal.index]);

  // Someone else's donation to this goal should move the bar on a page that is
  // already open — a goal being watched during a stream is the normal case.
  useLiveDonations({
    onDonation: (donation) => {
      if (donation.goalAddress !== goal.address) return;
      void revalidate();
      // The write-through needs a moment to land before the feed has it.
      setTimeout(() => void refreshFeed(), 1_200);
    },
  });

  const raised = BigInt(goal.raised);
  const target = BigInt(goal.target);
  const reached = raised >= target;
  const deadline = formatDeadline(
    goal.deadline === null ? null : BigInt(goal.deadline),
    language
  );

  return (
    <>
      <Nav />

      <main>
        <section className="border-b border-rule bg-ink-850">
          <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8">
            <Link
              href={`/c/${goal.handle}`}
              className="eyebrow text-mist-500 transition-colors hover:text-grape-400"
            >
              ← {creatorName}
            </Link>
          </div>

          <div className="mx-auto grid max-w-7xl px-5 sm:px-8 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="pb-12 lg:border-r lg:border-rule lg:pr-12 lg:pb-16">
              <div className="flex items-center gap-3">
                <StatusPill status={goal.status} />
                {deadline && (
                  <span className="eyebrow text-mist-600">{deadline}</span>
                )}
              </div>
              <h1 className="display mt-8 max-w-5xl text-[clamp(4rem,8vw,7.5rem)] leading-[0.86]">
                {goal.title}
              </h1>
              {goal.description && (
                <p className="mt-8 max-w-2xl text-lg leading-relaxed text-mist-500">
                  {goal.description}
                </p>
              )}
            </div>

            <aside className="border-t border-rule py-8 lg:border-t-0 lg:pl-10">
              <p className="eyebrow text-mist-600">{t("progress")}</p>
              <p className="mt-5 font-mono text-[clamp(3rem,5vw,5rem)] font-bold leading-none tracking-[-0.08em]">
                {Math.round(percent(raised, target))}%
              </p>
              <div className="mt-7">
                <ProgressBar raised={raised} target={target} />
                <div className="mt-3 flex items-baseline justify-between font-mono text-sm">
                  <span className={reached ? "font-bold text-mint-500" : "font-bold"}>
                    {formatTokenAmount(raised, token.decimals)} {token.symbol}
                  </span>
                  <span className="text-mist-500">
                    {t("of", {
                      amount: formatTokenAmount(target, token.decimals),
                    })}
                  </span>
                </div>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-px border border-rule bg-rule">
                {[
                  [String(goal.donationCount), t("donations")],
                  [String(goal.supporterCount), t("supporters")],
                  [timeAgo(goal.createdAt, language), t("started")],
                ].map(([value, label]) => (
                  <div key={label} className="bg-ink-850 p-3">
                    <p className="font-mono text-xs font-bold">{value}</p>
                    <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.08em] text-mist-600">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.08em] text-mist-600">
                {verified ? `✓ ${t("verifiedOnChain")}` : t("verifying")}
              </p>
            </aside>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-20 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <div className="border-t border-rule-solid pt-5">
              <p className="eyebrow text-grape-400">{t("donationLedger")}</p>
              <h2 className="display mt-3 text-4xl">{t("recentSupport")}</h2>
              <p className="mt-2 text-xs text-mist-600">{t("ledgerBody")}</p>
            </div>

            <div className="mt-6">
              {donations.length === 0 ? (
                <p className="border-y border-rule py-8 text-sm text-mist-600">
                  {t("noDonations")}
                </p>
              ) : (
                <ol className="border-t border-rule">
                  {donations.map((donation, row) => (
                    <li
                      key={`${donation.signature}:${donation.eventIndex}`}
                      className="grid gap-3 border-b border-rule-faint py-5 sm:grid-cols-[3rem_1fr_auto]"
                    >
                      <span className="font-mono text-[10px] text-mist-600">
                        {String(row + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="font-mono text-xs text-mist-500">
                          {shortAddress(donation.donor, 5)}
                          {donation.isFirstTime && (
                            <span className="ml-2 border border-mint-400 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-mint-500">
                              {t("firstTime")}
                            </span>
                          )}
                        </p>
                        {donation.message && (
                          <p className="display mt-2 text-xl leading-snug">
                            “{donation.message}”
                          </p>
                        )}
                        <a
                          href={explorerTx(donation.signature)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block font-mono text-[9px] uppercase tracking-[0.08em] text-mist-600 hover:text-grape-400"
                        >
                          {timeAgo(donation.timestamp, language)} ·{" "}
                          {t("viewReceipt")}
                        </a>
                      </div>
                      <span className="font-mono text-sm font-bold text-mint-500">
                        +
                        {formatTokenAmount(
                          BigInt(donation.amount),
                          token.decimals
                        )}{" "}
                        {token.symbol}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          <aside className="space-y-8">
            {config && (
              <DonatePanel
                goalAddress={goal.address as Address}
                mint={goal.mint as Address}
                treasury={config.treasury as Address}
                feeBps={config.feeBps}
                handle={goal.handle}
                index={BigInt(goal.index)}
                disabled={goal.status !== 0}
                onDonated={() => {
                  void revalidate();
                  setTimeout(() => void refreshFeed(), 1_200);
                }}
              />
            )}

            <section className="border-t border-rule-solid pt-5">
              <p className="eyebrow text-grape-400">{t("leaderboard")}</p>
              <h2 className="display mt-2 text-3xl">{t("topSupporters")}</h2>
              <SupporterList
                supporters={supporters}
                decimals={token.decimals}
                symbol={token.symbol}
              />
            </section>

            {connected?.account && (
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
                {t("connectedAs", {
                  address: shortAddress(String(connected.account.address), 4),
                })}
              </p>
            )}
          </aside>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

export function GoalMissing() {
  const { t } = useLanguage();
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <p className="eyebrow text-grape-400">{t("goal404")}</p>
        <h1 className="display mt-5 text-6xl">{t("goalMissing")}</h1>
        <Link
          href="/explore"
          className="mt-7 inline-block text-xs font-bold uppercase tracking-[0.08em] text-grape-400 hover:underline"
        >
          {t("backGoals")}
        </Link>
      </main>
    </>
  );
}
