"use client";

import { useMemo, useState } from "react";

import { formatSol } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import type { DailyPointView } from "@/lib/views";

/// Daily donation totals.
///
/// One series, so there is no legend — the heading says what is plotted. Only
/// the busiest day is labelled directly; every other value lives in the hover
/// tooltip and in the table view below, which is also what makes the chart
/// readable without color.
///
/// The bars are a slightly stronger green than the mint used for amounts in
/// text. At bar width the text mint measures below the chroma floor and reads
/// as grey — a colour has to be more saturated to survive being a thin shape
/// than it does to survive being a word.

/// The viewBox is sized to the box the chart actually occupies — roughly the
/// panel's inner width by 150px — rather than to the data. An SVG that scales
/// uniformly takes its height from that ratio, so a viewBox picked to suit the
/// bar count would render a strip four times too tall on a wide screen.
const WIDTH = 1080;
const HEIGHT = 150;
const MAX_BAR = 24;
const RADIUS = 4;

/// Rounded at the data end, square at the baseline. A plain `rect` with `rx`
/// would round all four corners and lift the bar off its own axis.
function columnPath(x: number, top: number, width: number, bottom: number) {
  const height = bottom - top;
  const r = Math.min(RADIUS, width / 2, height);
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${top + r}`,
    `Q ${x} ${top} ${x + r} ${top}`,
    `L ${x + width - r} ${top}`,
    `Q ${x + width} ${top} ${x + width} ${top + r}`,
    `L ${x + width} ${bottom}`,
    "Z",
  ].join(" ");
}

export function DailyChart({ points }: { points: DailyPointView[] }) {
  const { language, t } = useLanguage();
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const { max, peak, slot, bar } = useMemo(() => {
    let max = 0n;
    let peak = -1;
    points.forEach((point, index) => {
      const value = BigInt(point.amount);
      if (value > max) {
        max = value;
        peak = index;
      }
    });

    const slot = WIDTH / Math.max(points.length, 1);
    // Cap the thickness rather than filling the slot: the leftover is the
    // surface gap that separates neighbouring bars.
    return { max, peak, slot, bar: Math.min(MAX_BAR, slot * 0.68) };
  }, [points]);

  if (points.length === 0) return null;

  const scale = (value: bigint) =>
    max === 0n ? 0 : Number((value * 10_000n) / max) / 10_000;

  const dayLabel = (day: string) =>
    new Date(`${day}T00:00:00Z`).toLocaleDateString(
      language === "ka" ? "ka-GE" : "en-US",
      { day: "numeric", month: "short", timeZone: "UTC" }
    );

  const active = hovered === null ? null : points[hovered];

  return (
    <div>
      {/* Room above the plot for the peak label, which sits outside the SVG. */}
      <div className="relative pt-5">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full"
          role="img"
          aria-label={t("dailyChartLabel")}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Recessive reference lines: the peak and the baseline. One step off
              the surface — lighter than it, since the surface is the dark one. */}
          <line
            x1={0}
            y1={6}
            x2={WIDTH}
            y2={6}
            stroke="rgba(178,178,220,0.12)"
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={HEIGHT - 1}
            x2={WIDTH}
            y2={HEIGHT - 1}
            stroke="rgba(178,178,220,0.30)"
            strokeWidth={1}
          />

          {points.map((point, index) => {
            const value = BigInt(point.amount);
            const x = index * slot + (slot - bar) / 2;
            const baseline = HEIGHT - 1;
            const top = baseline - scale(value) * (baseline - 6);

            return (
              <g key={point.day}>
                {/* Hit target spans the whole slot and the full height, so a
                    one-pixel bar is still easy to hover. */}
                <rect
                  x={index * slot}
                  y={0}
                  width={slot}
                  height={HEIGHT}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
                {value > 0n && (
                  <path
                    d={columnPath(x, top, bar, baseline)}
                    fill="var(--chart-green)"
                    opacity={hovered === null || hovered === index ? 1 : 0.45}
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Only the peak is labelled — a number on all thirty bars is unreadable
            and goes unread. The rest are in the tooltip and the table. */}
        {peak >= 0 && max > 0n && (
          <p
            className="pointer-events-none absolute top-0 font-mono text-[10px] font-bold text-mist-100"
            style={{
              left: `${Math.min(Math.max(((peak + 0.5) / points.length) * 100, 3), 97)}%`,
              transform: "translateX(-50%)",
            }}
          >
            {formatSol(max, 2)}
          </p>
        )}

        {active && (
          <div
            className="pointer-events-none absolute top-1/3 z-10 -translate-x-1/2 whitespace-nowrap border border-rule bg-ink-850 px-2.5 py-1.5 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.9)]"
            style={{
              left: `${Math.min(Math.max(((hovered! + 0.5) / points.length) * 100, 8), 92)}%`,
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-mist-600">
              {dayLabel(active.day)}
            </p>
            <p className="font-mono text-xs font-bold text-mist-100">
              {formatSol(BigInt(active.amount), 3)} SOL
            </p>
            <p className="font-mono text-[10px] text-mist-600">
              {active.count} {t("donations").toLowerCase()}
            </p>
          </div>
        )}
      </div>

      <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-[0.06em] text-mist-600">
        <span>{dayLabel(points[0].day)}</span>
        <span>{dayLabel(points[points.length - 1].day)}</span>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((value) => !value)}
        className="mt-3 border-b border-rule text-[10px] font-bold uppercase tracking-[0.08em] text-mist-500 hover:border-grape-400 hover:text-grape-400"
      >
        {showTable ? t("hideTable") : t("showTable")}
      </button>

      {showTable && (
        <div className="mt-3 max-h-64 overflow-y-auto border border-rule-faint">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="font-mono text-[9px] uppercase tracking-[0.08em] text-mist-600">
                <th className="px-3 py-2 font-bold">{t("day")}</th>
                <th className="px-3 py-2 text-right font-bold">SOL</th>
                <th className="px-3 py-2 text-right font-bold">
                  {t("donations")}
                </th>
              </tr>
            </thead>
            <tbody className="[font-variant-numeric:tabular-nums]">
              {points
                .filter((point) => point.count > 0)
                .reverse()
                .map((point) => (
                  <tr key={point.day} className="border-t border-rule-faint">
                    <td className="px-3 py-1.5 text-mist-500">
                      {dayLabel(point.day)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-mist-100">
                      {formatSol(BigInt(point.amount), 4)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-mist-500">
                      {point.count}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
