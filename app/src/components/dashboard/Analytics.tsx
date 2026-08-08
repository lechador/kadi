"use client";

import { useEffect, useState } from "react";

import { SupporterList } from "@/components/SupporterList";
import { INCUMBENT_FEE_BPS } from "@/lib/config";
import { formatSol, formatTokenAmount } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { NATIVE_MINT_SENTINEL, tokenFor } from "@/lib/tokens";
import type { DailyPointView, SupporterView } from "@/lib/views";
import { DailyChart } from "./DailyChart";

type Totals = {
  mint: string;
  raised: string;
  fees: string;
  donations: number;
  supporters: number;
};

type Payload = {
  available: boolean;
  daily?: DailyPointView[];
  totals?: Totals[];
  supporters?: SupporterView[];
};

function Tile({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="border-t border-rule py-4">
      <p className="eyebrow text-mist-600">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-mist-100">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-normal text-mist-500">{unit}</span>
        )}
      </p>
      {note && <p className="mt-1 text-[10px] leading-snug text-mist-600">{note}</p>}
    </div>
  );
}

/// What the index makes possible for a creator: the shape of their own
/// support over time, rather than a list of current balances.
///
/// Every figure here is derived from the donation log, which is derived from
/// the ledger — so nothing in this panel is a number only Kadi knows. Anyone
/// could recompute it from public transactions; the index just means it does
/// not take a full history walk to do so.
export function Analytics({ handle }: { handle: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/creators/${encodeURIComponent(handle)}/analytics`)
      .then((response) => response.json())
      .then((body: Payload) => {
        if (live) setData(body);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [handle]);

  if (failed || (data && !data.available)) {
    return (
      <section className="card border-rule p-6 sm:p-8">
        <p className="eyebrow text-grape-400">{t("analytics")}</p>
        <p className="mt-3 text-xs leading-relaxed text-mist-600">
          {t("noAnalytics")}
        </p>
      </section>
    );
  }

  if (!data) {
    return <div className="card h-64 animate-pulse opacity-50" />;
  }

  const totals = data.totals ?? [];
  const native = totals.find((entry) => entry.mint === NATIVE_MINT_SENTINEL);
  const others = totals.filter((entry) => entry.mint !== NATIVE_MINT_SENTINEL);

  const solRaised = BigInt(native?.raised ?? "0");
  const solFees = BigInt(native?.fees ?? "0");
  // What the same gross would have cost on a 7.5% platform, minus what it
  // actually cost here. The comparison the whole product is an argument about.
  const wouldHaveCost = (solRaised * BigInt(INCUMBENT_FEE_BPS)) / 10_000n;
  const kept = wouldHaveCost > solFees ? wouldHaveCost - solFees : 0n;

  const supporters = data.supporters ?? [];
  const daily = data.daily ?? [];
  const totalDonations = totals.reduce((sum, entry) => sum + entry.donations, 0);
  const uniqueSupporters = Math.max(
    ...totals.map((entry) => entry.supporters),
    0
  );

  return (
    <section className="card border-rule p-6 sm:p-8">
      <p className="eyebrow text-grape-400">{t("analytics")}</p>
      <h2 className="display mt-2 text-3xl">{t("last30Days")}</h2>

      <div className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label={t("lifetimeRaised")}
          value={formatSol(solRaised, 3)}
          unit="SOL"
        />
        <Tile
          label={t("donations")}
          value={totalDonations.toLocaleString()}
        />
        <Tile
          label={t("uniqueSupporters")}
          value={uniqueSupporters.toLocaleString()}
        />
        <Tile
          label={t("lifetimeFees")}
          value={formatSol(solFees, 4)}
          unit="SOL"
          note={
            kept > 0n
              ? t("savedWouldHaveBeen", { amount: formatSol(kept, 3) })
              : undefined
          }
        />
      </div>

      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-rule pt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-mist-600">
          {others.map((entry) => {
            const token = tokenFor(entry.mint);
            return (
              <span key={entry.mint}>
                {formatTokenAmount(BigInt(entry.raised), token.decimals)}{" "}
                {token.symbol} · {entry.donations}
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        {daily.some((point) => point.count > 0) ? (
          <DailyChart points={daily} />
        ) : (
          <p className="border-y border-rule-faint py-8 text-center text-xs text-mist-600">
            {t("noDonations")}
          </p>
        )}
      </div>

      {supporters.length > 0 && (
        <div className="mt-8 border-t border-rule pt-5">
          <p className="eyebrow text-mist-600">{t("topSupportersAllTime")}</p>
          <SupporterList supporters={supporters} />
        </div>
      )}
    </section>
  );
}
