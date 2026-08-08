import { ImageResponse } from "next/og";

import { formatTokenAmount, percent } from "@/lib/format";
import { loadGoal } from "@/lib/server/data";
import { OG_SIZE, PALETTE, clip, ogFonts } from "@/lib/server/og";
import { tokenFor } from "@/lib/tokens";

/// The card that appears when a goal is pasted into a chat.
///
/// It shows the progress bar, because that is the thing that makes someone
/// click: a goal at 80% is a different message from a goal at 5%, and a
/// generic logo card says neither.

export const runtime = "nodejs";

type Context = { params: Promise<{ handle: string; index: string }> };

export async function GET(_request: Request, context: Context) {
  const { handle, index } = await context.params;
  const parsed = Number(index);

  const { data: goal } = Number.isInteger(parsed)
    ? await loadGoal(handle, parsed).catch(() => ({ data: null }))
    : { data: null };

  const fonts = await ogFonts();

  if (!goal) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: PALETTE.paper,
            color: PALETTE.ink,
            fontSize: 64,
            fontFamily: "Noto Sans Georgian",
          }}
        >
          Kadi — ნაკადი
        </div>
      ),
      { ...OG_SIZE, fonts }
    );
  }

  const token = tokenFor(goal.mint);
  const raised = BigInt(goal.raised);
  const target = BigInt(goal.target);
  const share = percent(raised, target);
  const reached = raised >= target;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PALETTE.paper,
          color: PALETTE.ink,
          fontFamily: "Noto Sans Georgian",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, color: PALETTE.red }}>
            @{clip(goal.handle, 28)}
          </div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: PALETTE.muted }}>
            KADI · ნაკადი
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: goal.title.length > 40 ? 62 : 84,
              fontWeight: 700,
              lineHeight: 1.05,
              maxWidth: 1000,
            }}
          >
            {clip(goal.title, 78)}
          </div>
          {goal.description && (
            <div
              style={{
                display: "flex",
                marginTop: 20,
                fontSize: 28,
                color: PALETTE.muted,
                maxWidth: 900,
              }}
            >
              {clip(goal.description, 110)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 52, fontWeight: 700 }}>
                {formatTokenAmount(raised, token.decimals)}
              </span>
              <span style={{ fontSize: 30, color: PALETTE.muted }}>
                / {formatTokenAmount(target, token.decimals)} {token.symbol}
              </span>
            </div>
            <span
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: reached ? PALETTE.green : PALETTE.red,
              }}
            >
              {Math.round(share)}%
            </span>
          </div>

          <div style={{ display: "flex", width: "100%", height: 16, background: "rgba(23,23,20,0.12)" }}>
            <div
              style={{
                display: "flex",
                width: `${Math.max(share, raised > 0n ? 1.5 : 0)}%`,
                height: "100%",
                background: reached ? PALETTE.green : PALETTE.red,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 18,
              fontSize: 22,
              color: PALETTE.muted,
            }}
          >
            <span>
              {goal.supporterCount} მხარდამჭერი · {goal.donationCount} დონაცია
            </span>
            <span>97.5% რჩება კრეატორს</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      headers: {
        // Long enough that a viral share does not re-render the card for every
        // crawler, short enough that the bar is not visibly stale.
        "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
