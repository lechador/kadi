import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db/client";
import { ingestSignature } from "@/lib/server/indexer";

/// Write-through for a freshly confirmed donation.
///
/// The browser calls this the moment its transaction confirms, so the goal
/// page, the activity feed and the leaderboard reflect the donation in the same
/// second instead of on the next cron tick.
///
/// Deliberately unauthenticated. The only thing a caller can do is ask the
/// server to read a transaction that already exists on chain: the record
/// written is the program's own emitted event, not anything the caller
/// supplied, and a signature that carries no Kadi donation writes nothing.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// Base58, and the length a 64-byte Ed25519 signature encodes to. Rejecting
/// here means a malformed value never reaches the RPC.
const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/;

/// A single instance's memory of who has been calling. Serverless spreads
/// requests across instances so this is a speed bump, not a quota — but the
/// expensive path behind it is one RPC read, and the insert it guards is
/// idempotent, so a speed bump is the right size of defence.
const recentCallers = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function rateLimited(request: Request): boolean {
  const caller =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = recentCallers.get(caller);

  if (!entry || now > entry.resetAt) {
    recentCallers.set(caller, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep so the map cannot grow without bound on a
    // long-lived instance.
    if (recentCallers.size > 5_000) {
      for (const [key, value] of recentCallers) {
        if (now > value.resetAt) recentCallers.delete(key);
      }
    }
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    // Not an error: without a cache there is nothing to write through to, and
    // every page still reads from chain.
    return NextResponse.json({ ok: true, indexed: 0, cached: false });
  }

  if (rateLimited(request)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  let body: { signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const signature = typeof body.signature === "string" ? body.signature : "";
  if (!SIGNATURE_PATTERN.test(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await ingestSignature(signature);
    return NextResponse.json({ ok: true, indexed: result.added, cached: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not index",
      },
      { status: 500 }
    );
  }
}
