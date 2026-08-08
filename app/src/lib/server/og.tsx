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

export const PALETTE = {
  paper: "#f3efe6",
  paperLight: "#faf7f0",
  ink: "#171714",
  red: "#c63d2f",
  green: "#2e5b45",
  muted: "#68635a",
  rule: "rgba(23, 23, 20, 0.18)",
};

/// Satori has no text-overflow, so anything that could exceed the card is
/// clipped here instead of silently overflowing the frame.
export function clip(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}
