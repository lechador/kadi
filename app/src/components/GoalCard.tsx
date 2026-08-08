import Link from "next/link";
import { unwrapOption } from "@solana/kit";

import { GoalStatus, type Goal } from "@/generated";
import { formatDeadline, formatTokenAmount, percent } from "@/lib/format";
import { tokenFor } from "@/lib/tokens";
import { ProgressBar } from "./ProgressBar";

export function StatusPill({ status }: { status: GoalStatus }) {
  const styles: Record<GoalStatus, string> = {
    [GoalStatus.Active]: "border-mint-400 text-mint-500",
    [GoalStatus.Completed]: "border-grape-400 text-grape-500",
    [GoalStatus.Archived]: "border-black/25 text-mist-500",
  };
  const labels: Record<GoalStatus, string> = {
    [GoalStatus.Active]: "Active",
    [GoalStatus.Completed]: "Completed",
    [GoalStatus.Archived]: "Archived",
  };

  return (
    <span
      className={`border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function GoalCard({
  goal,
  handle,
  showCreator = false,
}: {
  goal: Goal;
  handle: string;
  showCreator?: boolean;
}) {
  const deadline = formatDeadline(unwrapOption(goal.deadline));
  const reached = goal.raised >= goal.target;
  const token = tokenFor(goal.mint);

  return (
    <Link
      href={`/goal/${handle}/${goal.index}`}
      className="card card-hover group flex min-h-60 flex-col p-5 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        {showCreator ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-grape-400">
            @{handle}
          </span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mist-600">
            Goal {goal.index.toString().padStart(2, "0")}
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
        <ProgressBar raised={goal.raised} target={goal.target} className="mb-3" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-mist-100">
            <span className="font-bold">
              {formatTokenAmount(goal.raised, token.decimals)}
            </span>
            <span className="text-mist-500">
              {" "}
              / {formatTokenAmount(goal.target, token.decimals)} {token.symbol}
            </span>
          </span>
          <span className={reached ? "font-bold text-mint-300" : "text-mist-500"}>
            {Math.round(percent(goal.raised, goal.target))}%
          </span>
        </div>

        <div className="mt-2 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.05em] text-mist-600">
          <span>
            {goal.supporterCount.toString()} supporter
            {goal.supporterCount === 1n ? "" : "s"}
          </span>
          {deadline && <span>· {deadline}</span>}
        </div>
      </div>
    </Link>
  );
}
