"use client";

import Link from "next/link";

import { formatDeadline, formatTokenAmount, percent } from "@/lib/format";
import { tokenFor } from "@/lib/tokens";
import type { GoalView } from "@/lib/views";
import { ProgressBar } from "./ProgressBar";
import { useLanguage } from "@/lib/i18n";

/// Takes the plain `GoalView` rather than the decoded account, so the same
/// card renders from a server page's database read and from a client
/// component's live chain read without a second implementation.

const STATUS_STYLES: Record<number, string> = {
  0: "border-mint-400 text-mint-500",
  1: "border-grape-400 text-grape-500",
  2: "border-black/25 text-mist-500",
};

export function StatusPill({ status }: { status: number }) {
  const { t } = useLanguage();
  const labels: Record<number, string> = {
    0: t("active"),
    1: t("completed"),
    2: t("archived"),
  };

  return (
    <span
      className={`border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${
        STATUS_STYLES[status] ?? STATUS_STYLES[2]
      }`}
    >
      {labels[status] ?? labels[2]}
    </span>
  );
}

export function GoalCard({
  goal,
  showCreator = false,
}: {
  goal: GoalView;
  showCreator?: boolean;
}) {
  const { language, t } = useLanguage();

  const raised = BigInt(goal.raised);
  const target = BigInt(goal.target);
  const deadline = formatDeadline(
    goal.deadline === null ? null : BigInt(goal.deadline),
    language
  );
  const reached = raised >= target;
  const token = tokenFor(goal.mint);

  return (
    <Link
      href={`/goal/${goal.handle}/${goal.index}`}
      className="card card-hover group flex min-h-60 flex-col p-5 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        {showCreator ? (
          <span className="truncate font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-grape-400">
            @{goal.handle}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mist-600">
            {t("goal")} {String(goal.index).padStart(2, "0")}
          </span>
        )}
        <StatusPill status={goal.status} />
      </div>

      <h3 className="display text-[1.7rem] leading-[1.03] text-mist-100">
        {goal.title}
      </h3>

      {goal.description && (
        <p className="mb-7 mt-3 line-clamp-2 max-w-md text-sm leading-relaxed text-mist-500">
          {goal.description}
        </p>
      )}

      <div className="mt-auto border-t border-black/15 pt-4 group-hover:border-white/25">
        <ProgressBar raised={raised} target={target} className="mb-3" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-mist-100">
            <span className="font-bold">
              {formatTokenAmount(raised, token.decimals)}
            </span>
            <span className="text-mist-500">
              {" "}
              / {formatTokenAmount(target, token.decimals)} {token.symbol}
            </span>
          </span>
          <span className={reached ? "font-bold text-mint-300" : "text-mist-500"}>
            {Math.round(percent(raised, target))}%
          </span>
        </div>

        <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.05em] text-mist-600">
          <span>
            {goal.supporterCount}{" "}
            {goal.supporterCount === 1 ? t("supporter") : t("supporters")}
          </span>
          {deadline && <span>· {deadline}</span>}
        </div>
      </div>
    </Link>
  );
}
