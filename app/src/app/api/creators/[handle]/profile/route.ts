import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db/client";
import { getCreatorByHandle } from "@/lib/db/read";
import { upsertProfile } from "@/lib/db/write";
import { authoriseHandle, isAuthorised } from "@/lib/server/auth";
import { parseProfile } from "@/lib/server/validate";

/// The off-chain half of a creator page: banner, avatar, socials, category,
/// the longer "about" that would not fit in the 200-byte on-chain bio.
///
/// The on-chain profile stays where it is. Anything a donor needs in order to
/// decide whether to give — the handle, the display name, the goal, the
/// amounts — is on the chain and stays readable without this table.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ handle: string }> };

export async function GET(_request: Request, context: Context) {
  const { handle } = await context.params;
  if (!isDatabaseConfigured()) return NextResponse.json({ profile: null });

  const creator = await getCreatorByHandle(handle);
  return NextResponse.json({ profile: creator?.profile ?? null });
}

export async function PUT(request: Request, context: Context) {
  const { handle } = await context.params;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "No database configured — profiles cannot be stored" },
      { status: 503 }
    );
  }

  const authorisation = await authoriseHandle(handle);
  if (!isAuthorised(authorisation)) {
    return NextResponse.json(
      { error: authorisation.error },
      { status: authorisation.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const profile = parseProfile(body);
  await upsertProfile(authorisation.creatorAddress, authorisation.address, profile);

  return NextResponse.json({ profile });
}
