import "server-only";

import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";
import { cookies } from "next/headers";
import { getAddressEncoder, type Address } from "@solana/kit";

import { fetchCreatorByHandle } from "../queries";
import { serverRpc } from "./rpc";

/// Sign-In With Solana, for the parts of Kadi that are not on-chain.
///
/// Nothing here can move money — the program is the only thing that can, and it
/// checks the signer itself on every instruction. This exists so the *off-chain*
/// records (a banner image, an overlay's colour) have an owner too, and a
/// wallet proving control of a keypair is the only credential the app has any
/// business asking for. No password, no email, nothing to leak.

const SESSION_COOKIE = "kadi_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error(
      "AUTH_SECRET is not set — required to sign session cookies. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// The signed message
// ---------------------------------------------------------------------------

export type Challenge = { nonce: string; message: string };

export function newNonce(): string {
  return randomBytes(24).toString("base64url");
}

/// Human-readable on purpose. A wallet shows this text verbatim, and a prompt
/// someone cannot read is a prompt they cannot refuse meaningfully.
export function buildMessage(input: {
  domain: string;
  address: string;
  nonce: string;
  issuedAt: string;
}): string {
  return [
    `${input.domain} wants you to sign in with your Solana account:`,
    input.address,
    "",
    "Signing proves you control this wallet. It authorises no transaction and moves no funds.",
    "",
    `URI: https://${input.domain}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
  ].join("\n");
}

function fieldFrom(message: string, label: string): string | null {
  const match = new RegExp(`^${label}: (.+)$`, "m").exec(message);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/// A bare Ed25519 public key wrapped in the SPKI DER header Node's key parser
/// expects. The 12 bytes are a fixed prefix: SEQUENCE, the Ed25519 algorithm
/// OID (1.3.101.112), and a BIT STRING header for the 32 key bytes.
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifySignature(
  address: string,
  message: string,
  signature: Uint8Array
): boolean {
  if (signature.length !== 64) return false;

  let publicKey: Buffer;
  try {
    publicKey = Buffer.from(getAddressEncoder().encode(address as Address));
  } catch {
    return false; // not a valid base58 address
  }
  if (publicKey.length !== 32) return false;

  try {
    const key = createPublicKey({
      key: Buffer.concat([SPKI_ED25519_PREFIX, publicKey]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message, "utf8"), key, signature);
  } catch {
    return false;
  }
}

export type VerifyResult =
  | { ok: true; address: string }
  | { ok: false; reason: string };

/// Checks the message the wallet actually signed, rather than rebuilding it
/// from parts. A signature only means something over the exact bytes shown to
/// the user, so those bytes are what gets verified — and then every claim
/// inside them is checked against what the server expects.
export function verifyChallenge(input: {
  address: string;
  message: string;
  signature: Uint8Array;
  expectedDomain: string;
  expectedNonce: string;
}): VerifyResult {
  const { address, message, signature, expectedDomain, expectedNonce } = input;

  const nonce = fieldFrom(message, "Nonce");
  if (nonce !== expectedNonce) return { ok: false, reason: "Nonce mismatch" };

  // The address the signature is checked against must be the one the user was
  // shown, or a valid signature over someone else's message would pass.
  const [firstLine, claimedAddress] = message.split("\n");
  if (claimedAddress !== address) {
    return { ok: false, reason: "Address does not match the signed message" };
  }
  if (!firstLine.startsWith(`${expectedDomain} wants you to sign in`)) {
    return { ok: false, reason: "Message was issued for a different site" };
  }

  const issuedAt = fieldFrom(message, "Issued At");
  const issuedMs = issuedAt ? Date.parse(issuedAt) : Number.NaN;
  if (Number.isNaN(issuedMs) || Math.abs(Date.now() - issuedMs) > 10 * 60_000) {
    return { ok: false, reason: "Message has expired" };
  }

  if (!verifySignature(address, message, signature)) {
    return { ok: false, reason: "Signature is not valid for this address" };
  }

  return { ok: true, address };
}

// ---------------------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------------------

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueToken(address: string): string {
  const payload = Buffer.from(
    JSON.stringify({ a: address, e: Date.now() + SESSION_TTL_MS })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(sign(payload));

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof claims.a !== "string" || typeof claims.e !== "number") return null;
    if (Date.now() > claims.e) return null;
    return claims.a;
  } catch {
    return null;
  }
}

export async function setSessionCookie(address: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, issueToken(address), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/// The wallet address this request is authenticated as, or null.
export async function currentAddress(): Promise<string | null> {
  const store = await cookies();
  return readToken(store.get(SESSION_COOKIE)?.value);
}

// ---------------------------------------------------------------------------
// Authorisation
// ---------------------------------------------------------------------------

export type Authorised = {
  address: string;
  creatorAddress: string;
  handle: string;
};

/// A session proves which wallet is calling; this proves that wallet owns the
/// handle it is trying to edit. The check reads the creator account from chain
/// rather than the mirrored row, because the chain is where ownership actually
/// lives and a cache is the wrong thing to make an access decision on.
export async function authoriseHandle(
  handle: string
): Promise<Authorised | { error: string; status: number }> {
  const address = await currentAddress();
  if (!address) return { error: "Not signed in", status: 401 };

  const creator = await fetchCreatorByHandle(serverRpc(), handle);
  if (!creator) return { error: `No creator @${handle}`, status: 404 };

  if (creator.data.owner !== address) {
    return { error: "That handle belongs to another wallet", status: 403 };
  }

  return { address, creatorAddress: creator.address, handle };
}

export function isAuthorised(
  result: Awaited<ReturnType<typeof authoriseHandle>>
): result is Authorised {
  return "address" in result;
}
