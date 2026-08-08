"use client";

import Link from "next/link";

import { formatTokenAmount, shortAddress, timeAgo } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { useLiveDonations, withKnownCreators } from "@/lib/live";
import { tokenFor } from "@/lib/tokens";
import type { DonationView } from "@/lib/views";

/// The protocol's pulse, live. Server-rendered from the indexed feed so it is
/// never empty on first paint, then extended in place by the log subscription.
export function LiveTicker({ initial }: { initial: DonationView[] }) {
  const { language, t } = useLanguage();
  const { connected, latest } = useLiveDonations();

  // A donation the socket delivers is also in the indexed feed a moment later.
  // Keying by signature keeps whichever arrived first and drops the repeat.
  const seen = new Set<string>();
  const donations = [...withKnownCreators(latest, initial), ...initial]
    .filter((donation) => {
      const key = `${donation.signature}:${donation.eventIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);

  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex items-center gap-3 border-b border-rule-faint py-3">
          <span
            className={`h-2 w-2 shrink-0 ${
              connected ? "animate-pulse bg-mint-400" : "bg-mist-600"
            }`}
          />
          <p className="eyebrow text-mist-500">
            {connected ? t("liveNow") : t("recentActivity")}
          </p>
          <Link
            href="/activity"
            className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-grape-400 hover:underline"
          >
            {t("seeAll")}
          </Link>
        </div>

        <ul className="flex snap-x gap-px overflow-x-auto bg-ink-900 py-px">
          {donations.map((donation) => {
            const token = tokenFor(donation.mint);
            return (
              <li
                key={`${donation.signature}:${donation.eventIndex}`}
                className="min-w-56 shrink-0 snap-start bg-ink-950 p-4"
              >
                <p className="font-mono text-sm font-bold text-mint-500">
                  +{formatTokenAmount(BigInt(donation.amount), token.decimals)}{" "}
                  {token.symbol}
                </p>
                <p className="mt-1 truncate font-mono text-[10px] text-mist-600">
                  {shortAddress(donation.donor, 4)}
                  {donation.handle ? ` → @${donation.handle}` : ""}
                </p>
                {donation.message ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-snug text-mist-500">
                    “{donation.message}”
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-mist-600">
                    {timeAgo(donation.timestamp, language)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
