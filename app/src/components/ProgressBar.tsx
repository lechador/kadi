import { percent } from "@/lib/format";

export function ProgressBar({
  raised,
  target,
  className = "",
}: {
  raised: bigint;
  target: bigint;
  className?: string;
}) {
  const pct = percent(raised, target);
  const reached = raised >= target;

  return (
    <div
      className={`h-1.5 w-full overflow-hidden bg-black/10 ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Goal progress"
    >
      <div
        className={`relative h-full transition-[width] duration-700 ease-out ${
          reached ? "bg-mint-500" : "bg-grape-400"
        }`}
        style={{ width: `${Math.max(pct, raised > 0n ? 1.5 : 0)}%` }}
      >
        {raised > 0n && !reached && <span className="shimmer absolute inset-y-0 left-0" />}
      </div>
    </div>
  );
}
