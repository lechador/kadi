import { ImageResponse } from "next/og";

import { INCUMBENT_FEE_BPS } from "@/lib/config";
import { OG_SIZE, PALETTE, ogFonts } from "@/lib/server/og";

/// The default share card, for every page that has nothing more specific.
///
/// Rendered rather than served as a static PNG so it stays in step with the
/// palette — the committed og.png was drawn for the old paper theme, and a
/// stale brand card is the one asset nobody notices is wrong until it is in
/// somebody else's chat window.

export const runtime = "nodejs";

export async function GET() {
  const fonts = await ogFonts();

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
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            letterSpacing: 3,
            color: PALETTE.muted,
          }}
        >
          <span>KADI · ნაკადი</span>
          <span>SOLANA</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 92,
              fontWeight: 700,
              lineHeight: 1.02,
              maxWidth: 1000,
            }}
          >
            დაიტოვე ის, რასაც აუდიტორია გჩუქნის.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 26,
              fontSize: 30,
              color: PALETTE.muted,
              maxWidth: 900,
            }}
          >
            არაკასტოდიული დონაციები კრეატორებისთვის. თანხა წამებში ჩამოდის და
            კრეატორის საცავში რჩება.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: `2px solid ${PALETTE.rule}`,
            paddingTop: 26,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <span
              style={{
                fontSize: 64,
                fontWeight: 700,
                color: PALETTE.muted,
                textDecoration: "line-through",
              }}
            >
              {(INCUMBENT_FEE_BPS / 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: 40, color: PALETTE.muted }}>→</span>
            <span style={{ fontSize: 64, fontWeight: 700, color: PALETTE.green }}>
              2.5%
            </span>
          </div>
          <span style={{ fontSize: 24, color: PALETTE.muted, letterSpacing: 2 }}>
            97.5% რჩება კრეატორს
          </span>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    }
  );
}
