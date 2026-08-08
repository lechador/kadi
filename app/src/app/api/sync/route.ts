import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db/client";
import { pruneExpiredNonces } from "@/lib/db/write";
import { syncAll } from "@/lib/server/indexer";

/// The scheduled sweep.
///
/// Point a cron at it — Vercel Cron, a GitHub Action, `curl` in a systemd
/// timer, anything that can send a header. `?full=1` ignores the stored cursor
/// and rewalks the whole history, which is how a database restored from
/// nothing catches up.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A sweep walks up to 2,000 signatures; the platform default of 15s is not
// enough for a cold catch-up run.
export const maxDuration = 300;

/// Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; a hand-rolled cron
/// may find `?secret=` easier. Both are accepted, and the comparison is
/// length-safe rather than an early-exit `===`.
///
/// `INDEXER_SECRET` and `CRON_SECRET` are both honoured, and a caller matching
/// *either* is let in. Preferring one over the other would mean that setting
/// both — the natural thing to do when `CRON_SECRET` is the name Vercel
/// populates its header from — locks out the platform's own scheduler with a
/// 401 that looks like nothing is wrong until the index quietly stops moving.
function authorised(request: Request): boolean {
  const accepted = [
    process.env.INDEXER_SECRET,
    process.env.CRON_SECRET,
  ].filter((value): value is string => !!value);

  // No secret configured means local development, where the endpoint is only
  // reachable from the developer's own machine. In production it is refused
  // outright rather than left open — a sweep that never runs is a stale page,
  // but a public endpoint is a way to bill someone else's RPC quota.
  if (accepted.length === 0) return process.env.NODE_ENV !== "production";

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const fromQuery = new URL(request.url).searchParams.get("secret") ?? "";

  return accepted.some(
    (expected) =>
      timingSafeEqual(bearer, expected) || timingSafeEqual(fromQuery, expected)
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function handle(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL is not set. The app still reads from chain; the cache is simply not being filled.",
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const full = url.searchParams.get("full") === "1";
  const budget = Number(url.searchParams.get("budget")) || undefined;

  try {
    const report = await syncAll({ full, budget });
    // Cheap enough to fold into the sweep, and it keeps the challenge table
    // from accumulating rows nobody will ever redeem.
    await pruneExpiredNonces();
    return NextResponse.json({ ok: true, ...report });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
