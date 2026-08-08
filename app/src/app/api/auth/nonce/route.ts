import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db/client";
import { createNonce } from "@/lib/db/write";
import { buildMessage, newNonce } from "@/lib/server/auth";

/// Issues a single-use challenge and the exact text the wallet will display.
///
/// The message is built here rather than in the browser so the bytes the user
/// sees, the bytes they sign and the bytes the server verifies are the same
/// bytes — a client that assembled its own message could show one thing and
/// sign another.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Sign-in needs DATABASE_URL — challenges have to be stored somewhere they can only be redeemed once.",
      },
      { status: 503 }
    );
  }

  let body: { address?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address : "";
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const nonce = newNonce();
  await createNonce(nonce);

  const domain =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "kadi.fund";

  return NextResponse.json({
    nonce,
    message: buildMessage({
      domain,
      address,
      nonce,
      issuedAt: new Date().toISOString(),
    }),
  });
}
