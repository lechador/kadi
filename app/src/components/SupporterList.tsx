import type { Address } from "@solana/kit";

import type { Supporter } from "@/generated";
import { formatTokenAmount, shortAddress, timeAgo } from "@/lib/format";
import type { WithAddress } from "@/lib/queries";

const MEDALS = ["🥇", "🥈", "🥉"];

export function SupporterList({
  supporters,
  decimals = 9,
  symbol = "SOL",
  emptyMessage = "No supporters yet — be the first.",
}: {
  supporters: WithAddress<Supporter>[];
  decimals?: number;
  symbol?: string;
  emptyMessage?: string;
}) {
  if (supporters.length === 0) {
    return <p className="py-6 text-center text-sm text-mist-600">{emptyMessage}</p>;
  }

  return (
    <ol className="divide-y divide-black/10">
      {supporters.map((supporter, rank) => (
        <li
          key={supporter.address}
          className="flex items-center justify-between gap-3 py-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="w-6 shrink-0 text-center text-sm">
              {MEDALS[rank] ?? (
                <span className="text-mist-600">{rank + 1}</span>
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate font-mono text-sm text-mist-100">
                {shortAddress(supporter.data.donor as Address, 5)}
              </p>
              <p className="text-xs text-mist-600">
                {supporter.data.count.toString()}× · last{" "}
                {timeAgo(supporter.data.lastDonatedAt)}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold text-mist-100">
            {formatTokenAmount(supporter.data.total, decimals)} {symbol}
          </span>
        </li>
      ))}
    </ol>
  );
}
