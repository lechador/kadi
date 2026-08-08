"use client";

import { formatTokenAmount, shortAddress, timeAgo } from "@/lib/format";
import type { SupporterView } from "@/lib/views";
import { useLanguage } from "@/lib/i18n";

const MEDALS = ["🥇", "🥈", "🥉"];

export function SupporterList({
  supporters,
  decimals = 9,
  symbol = "SOL",
  emptyMessage,
}: {
  supporters: SupporterView[];
  decimals?: number;
  symbol?: string;
  emptyMessage?: string;
}) {
  const { language, t } = useLanguage();

  if (supporters.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-mist-600">
        {emptyMessage ?? t("noSupporters")}
      </p>
    );
  }

  return (
    <ol className="divide-y divide-black/10">
      {supporters.map((supporter, rank) => (
        <li
          key={supporter.donor}
          className="flex items-center justify-between gap-3 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-6 shrink-0 text-center text-sm">
              {MEDALS[rank] ?? <span className="text-mist-600">{rank + 1}</span>}
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-mist-100">
                {shortAddress(supporter.donor, 5)}
              </p>
              <p className="text-xs text-mist-600">
                {supporter.count}× · {t("last")}{" "}
                {timeAgo(supporter.lastAt, language)}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold text-mist-100">
            {formatTokenAmount(BigInt(supporter.total), decimals)} {symbol}
          </span>
        </li>
      ))}
    </ol>
  );
}
