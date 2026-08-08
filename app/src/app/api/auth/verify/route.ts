import { NextResponse } from "next/server";

import { consumeNonce } from "@/lib/db/write";
import { setSessionCookie, verifyChallenge } from "@/lib/server/auth";

/// Redeems a challenge and issues the session cookie.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { address?: unknown; message?: unknown; signature?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address : "";
  const message = typeof body.message === "string" ? body.message : "";
  const encoded = typeof body.signature === "string" ? body.signature : "";

  if (!address || !message || !encoded) {
    return NextResponse.json(
      { error: "address, message and signature are all required" },
      { status: 400 }
    );
  }

  const nonceMatch = /^Nonce: (.+)$/m.exec(message);
  if (!nonceMatch) {
    return NextResponse.json({ error: "Message carries no nonce" }, { status: 400 });
  }

  // Redeemed before the signature is checked, so a valid signature over a
  // captured message cannot be replayed — the second attempt finds the
  // challenge already gone.
  if (!(await consumeNonce(nonceMatch[1].trim()))) {
    return NextResponse.json(
      { error: "That challenge has expired or was already used" },
      { status: 400 }
    );
  }

  let signature: Uint8Array;
  try {
    signature = new Uint8Array(Buffer.from(encoded, "base64"));
  } catch {
    return NextResponse.json({ error: "Malformed signature" }, { status: 400 });
  }

  const domain =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "kadi.fund";

  const result = verifyChallenge({
    address,
    message,
    signature,
    expectedDomain: domain,
    expectedNonce: nonceMatch[1].trim(),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 401 });
  }

  await setSessionCookie(result.address);
  return NextResponse.json({ address: result.address });
}
