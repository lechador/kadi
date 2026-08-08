"use client";

import Link from "next/link";
import { useState } from "react";

import { Nav } from "@/components/Nav";
import { SiteFooter } from "@/components/SiteFooter";
import { explorerTx } from "@/lib/config";
import { formatTokenAmount, shortAddress, timeAgo } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import {
  useLiveDonations,
  withKnownCreators,
  type LiveDonation,
} from "@/lib/live";
import { tokenFor } from "@/lib/tokens";
import type { DonationView } from "@/lib/views";

/// Every donation on the protocol, newest first.
///
/// The rows below the fold come from the index; the ones at the top arrive on
/// the log subscription as they confirm. Both are the same event — the index
/// is just where it lands after the socket has already shown it.

export function ActivityView({
  initial,
  available,
}: {
  initial: DonationView[];
  available: boolean;
}) {
  const { language, t } = useLanguage();
  const [live, setLive] = useState<LiveDonation[]>([]);

  const { connected } = useLiveDonations({
    report: true,
    onDonation: (donation) =>
      setLive((current) => [donation, ...current].slice(0, 50)),
  });

  const seen = new Set<string>();
  const donations = [...withKnownCreators(live, initial), ...initial].filter(
    (donation) => {
      const key = `${donation.signature}:${donation.eventIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }
  );

  return (
    <>
      <Nav />

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="border-t border-black pt-5">
          <div className="flex items-center gap-3">
            <span
              className={`h-2 w-2 ${connected ? "animate-pulse bg-mint-400" : "bg-mist-600"}`}
            />
            <p className="eyebrow text-grape-400">
              {connected ? t("liveNow") : t("recentActivity")}
            </p>
          </div>
          <h1 className="display mt-3 text-5xl leading-none sm:text-6xl">
            {t("activityTitle")}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist-500">
            {t("activityBody")}
          </p>
        </div>

        {!available && (
          <p className="mt-8 border-y border-black/20 py-8 text-sm leading-relaxed text-mist-500">
            {t("activityNeedsIndex")}
          </p>
        )}

        {donations.length === 0 && available && (
          <p className="mt-8 border-y border-black/20 py-10 text-sm text-mist-600">
            {t("noDonations")}
          </p>
        )}

        <ol className="mt-8 border-t border-black/20">
          {donations.map((donation) => {
            const token = tokenFor(donation.mint);
            const isLive = "live" in donation;

            return (
              <li
                key={`${donation.signature}:${donation.eventIndex}`}
                className={`grid gap-3 border-b border-black/15 py-5 sm:grid-cols-[1fr_auto] ${
                  isLive ? "alert-enter" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-mist-500">
                    {shortAddress(donation.donor, 5)}
                    {donation.handle && (
                      <>
                        {" → "}
                        <Link
                          href={`/c/${donation.handle}`}
                          className="text-grape-400 hover:underline"
                        >
                          @{donation.handle}
                        </Link>
                      </>
                    )}
                    {donation.isFirstTime && (
                      <span className="ml-2 border border-mint-400 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-mint-500">
                        {t("firstTime")}
                      </span>
                    )}
                  </p>

                  {donation.goalTitle && donation.handle && (
                    <Link
                      href={`/goal/${donation.handle}/${donation.goalIndex}`}
                      className="display mt-1 block text-lg leading-snug hover:text-grape-400"
                    >
                      {donation.goalTitle}
                    </Link>
                  )}

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
                    {timeAgo(donation.timestamp, language)} · {t("viewReceipt")}
                  </a>
                </div>

                <span className="font-mono text-sm font-bold text-mint-500 sm:text-right">
                  +{formatTokenAmount(BigInt(donation.amount), token.decimals)}{" "}
                  {token.symbol}
                </span>
              </li>
            );
          })}
        </ol>
      </main>

      <SiteFooter />
    </>
  );
}
