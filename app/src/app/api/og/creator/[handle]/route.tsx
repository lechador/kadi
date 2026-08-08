import { ImageResponse } from "next/og";

import { formatSol } from "@/lib/format";
import { loadCreator, loadCreatorGoals } from "@/lib/server/data";
import { OG_SIZE, PALETTE, clip, ogFonts } from "@/lib/server/og";
import { NATIVE_MINT_SENTINEL } from "@/lib/tokens";

export const runtime = "nodejs";

type Context = { params: Promise<{ handle: string }> };

export async function GET(_request: Request, context: Context) {
  const { handle } = await context.params;
  const fonts = await ogFonts();

  const { data: creator } = await loadCreator(handle).catch(() => ({
    data: null,
  }));

  if (!creator) {
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

  const { data: goals } = await loadCreatorGoals(creator).catch(() => ({
    data: [],
  }));

  const solRaised = goals
    .filter((goal) => goal.mint === NATIVE_MINT_SENTINEL)
    .reduce((total, goal) => total + BigInt(goal.raised), 0n);
  const active = goals.filter((goal) => goal.status === 0).length;
  const name = creator.displayName || `@${creator.handle}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: PALETTE.paper,
          backgroundImage: PALETTE.bloom,
          color: PALETTE.ink,
          fontFamily: "Noto Sans Georgian",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 2, color: PALETTE.red }}>
            კრეატორის გვერდი
          </div>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: PALETTE.muted }}>
            KADI · ნაკადი
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: name.length > 24 ? 74 : 96,
              fontWeight: 700,
              lineHeight: 1.02,
              maxWidth: 1050,
            }}
          >
            {clip(name, 40)}
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: PALETTE.red }}>
            @{clip(creator.handle, 32)}
          </div>
          {creator.bio && (
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 28,
                color: PALETTE.muted,
                maxWidth: 940,
              }}
            >
              {clip(creator.bio, 120)}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: `2px solid ${PALETTE.rule}`,
            paddingTop: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, color: PALETTE.muted, letterSpacing: 2 }}>
              შეგროვებული
            </span>
            <span style={{ fontSize: 56, fontWeight: 700, color: PALETTE.green }}>
              {formatSol(solRaised, 2)} SOL
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: 22, color: PALETTE.muted, letterSpacing: 2 }}>
              ღია მიზნები
            </span>
            <span style={{ fontSize: 56, fontWeight: 700 }}>{active}</span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1200",
      },
    }
  );
}
