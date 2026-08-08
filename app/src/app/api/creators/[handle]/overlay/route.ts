import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db/client";
import { getCreatorByHandle, getOverlaySettings } from "@/lib/db/read";
import { upsertOverlaySettings } from "@/lib/db/write";
import { authoriseHandle, isAuthorised } from "@/lib/server/auth";
import { parseOverlaySettings } from "@/lib/server/validate";
import { DEFAULT_OVERLAY_SETTINGS } from "@/lib/views";

/// How a creator's OBS overlay looks and behaves.
///
/// GET is public because the overlay itself is a URL pasted into OBS with no
/// session attached — it is a browser source, not a logged-in page. Nothing
/// here is a secret; the settings are visible on stream by definition.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ handle: string }> };

export async function GET(_request: Request, context: Context) {
  const { handle } = await context.params;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ settings: DEFAULT_OVERLAY_SETTINGS });
  }

  const creator = await getCreatorByHandle(handle);
  if (!creator) {
    return NextResponse.json({ settings: DEFAULT_OVERLAY_SETTINGS });
  }

  return NextResponse.json({
    settings: await getOverlaySettings(creator.address),
  });
}

export async function PUT(request: Request, context: Context) {
  const { handle } = await context.params;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "No database configured — overlay settings cannot be stored" },
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

  const settings = parseOverlaySettings(body);
  await upsertOverlaySettings(
    authorisation.creatorAddress,
    authorisation.address,
    settings
  );

  return NextResponse.json({ settings });
}
