import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db/client";
import {
  getCreatorByHandle,
  getCreatorDailyTotals,
  getCreatorTotals,
  listCreatorTopSupporters,
} from "@/lib/db/read";
import { NATIVE_MINT_SENTINEL } from "@/lib/tokens";

/// Per-creator totals and a daily series.
///
/// Public, because every figure in it is derived from public transactions —
/// anyone can compute the same numbers from the ledger, and putting a session
/// in front of them would only be theatre.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ handle: string }> };

export async function GET(request: Request, context: Context) {
  const { handle } = await context.params;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ available: false });
  }

  const creator = await getCreatorByHandle(handle);
  if (!creator) {
    return NextResponse.json({ error: `No creator @${handle}` }, { status: 404 });
  }

  const days = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 7),
    365
  );

  const [daily, totals, supporters] = await Promise.all([
    getCreatorDailyTotals(creator.address, NATIVE_MINT_SENTINEL, days),
    getCreatorTotals(creator.address),
    listCreatorTopSupporters(creator.address, 8),
  ]);

  return NextResponse.json({ available: true, days, daily, totals, supporters });
}
