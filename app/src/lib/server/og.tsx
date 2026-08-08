import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/// Shared furniture for the generated share cards.
///
/// The fonts are bundled rather than pulled from a CDN because these images are
/// rendered on the server: satori shapes the glyphs itself and has no browser
/// to fall back on, so a Georgian title without a Georgian font renders as a
/// row of empty boxes. Noto Sans Georgian is OFL-licensed and the two subsets
/// used here total under 70 KB — the licence travels with them in
/// assets/fonts/LICENSE.

const FONT_DIR = join(process.cwd(), "assets", "fonts");

const FILES = [
  { file: "noto-sans-georgian-georgian-400-normal.woff", weight: 400 },
  { file: "noto-sans-georgian-georgian-700-normal.woff", weight: 700 },
  { file: "noto-sans-georgian-latin-400-normal.woff", weight: 400 },
  { file: "noto-sans-georgian-latin-700-normal.woff", weight: 700 },
] as const;

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

let cached: OgFont[] | undefined;

/// Read once per server process. A share card is rendered on every crawl of
/// every goal page, and re-reading four files each time is pure waste.
export async function ogFonts(): Promise<OgFont[]> {
  if (cached) return cached;

  const loaded = await Promise.all(
    FILES.map(async ({ file, weight }) => {
      const bytes = await readFile(join(FONT_DIR, file));
      return {
        name: "Noto Sans Georgian",
        // Satori wants a plain ArrayBuffer, and a Node Buffer is a view into a
        // larger pooled one — slicing to its own bounds is what makes it valid.
        data: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer,
        weight,
        style: "normal" as const,
      };
    })
  );

  cached = loaded;
  return loaded;
}

export const OG_SIZE = { width: 1200, height: 630 };

/// Mirrors the site's tokens. A share card is usually the first thing anyone
/// sees of Kadi — in a chat window, before the site — so it has to be the same
/// object as the page it links to, not a differently-coloured cousin.
export const PALETTE = {
  paper: "#08080f",
  paperLight: "#14141f",
  ink: "#f2f2fa",
  red: "#b083ff",
  green: "#2ee6a0",
  muted: "#8a8aa6",
  rule: "rgba(178, 178, 220, 0.22)",
  track: "rgba(178, 178, 220, 0.14)",
  /// The violet bloom the page carries behind its masthead. Satori has no
  /// radial-gradient support worth relying on, so the card fakes it with a
  /// linear one across the top edge.
  bloom:
    "linear-gradient(160deg, rgba(139, 92, 246, 0.30), rgba(8, 8, 15, 0) 55%)",
};

/// Satori has no text-overflow, so anything that could exceed the card is
/// clipped here instead of silently overflowing the frame.
export function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}
