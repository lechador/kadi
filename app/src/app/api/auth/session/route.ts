import { NextResponse } from "next/server";

import { clearSessionCookie, currentAddress } from "@/lib/server/auth";

/// GET reports who this browser is signed in as; DELETE signs it out.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ address: await currentAddress() });
}

export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ address: null });
}
