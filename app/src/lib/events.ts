import {
  addDecoderSizePrefix,
  getAddressDecoder,
  getBase64Encoder,
  getBooleanDecoder,
  getI64Decoder,
  getStructDecoder,
  getU32Decoder,
  getU64Decoder,
  getUtf8Decoder,
  type Address,
} from "@solana/kit";

import idl from "@/generated/idl.json";

export type DonationEvent = {
  goal: Address;
  creator: Address;
  donor: Address;
  mint: Address;
  amount: bigint;
  net: bigint;
  fee: bigint;
  message: string;
  raised: bigint;
  target: bigint;
  isFirstTime: boolean;
  timestamp: bigint;
};

// Field order must match `DonationEvent` in programs/kadi/src/events.rs —
// Anchor serialises events as plain Borsh with no field names on the wire.
const donationEventDecoder = getStructDecoder([
  ["goal", getAddressDecoder()],
  ["creator", getAddressDecoder()],
  ["donor", getAddressDecoder()],
  ["mint", getAddressDecoder()],
  ["amount", getU64Decoder()],
  ["net", getU64Decoder()],
  ["fee", getU64Decoder()],
  ["message", addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
  ["raised", getU64Decoder()],
  ["target", getU64Decoder()],
  ["isFirstTime", getBooleanDecoder()],
  ["timestamp", getI64Decoder()],
]);

type IdlEvent = { name: string; discriminator: number[] };

/// Read from the generated IDL rather than hard-coded, so a rename in the
/// program surfaces as a build-time failure instead of an overlay that
/// silently stops firing.
const DONATION_DISCRIMINATOR: Uint8Array = (() => {
  const events = (idl as { events?: IdlEvent[] }).events ?? [];
  const event = events.find(
    (candidate) => candidate.name.toLowerCase() === "donationevent"
  );
  if (!event) {
    throw new Error(
      "DonationEvent is missing from the IDL — rerun the program build"
    );
  }
  return new Uint8Array(event.discriminator);
})();

const PROGRAM_DATA_PREFIX = "Program data: ";
const base64Encoder = getBase64Encoder();

function startsWithDiscriminator(bytes: Uint8Array): boolean {
  if (bytes.length < DONATION_DISCRIMINATOR.length) return false;
  return DONATION_DISCRIMINATOR.every((byte, i) => bytes[i] === byte);
}

/// Extracts every donation from a transaction's logs. Anchor's `emit!` writes
/// the event as a base64 `Program data:` line, so the ledger itself is the
/// alert feed — no indexer, no database, no webhook.
export function parseDonationEvents(
  logs: readonly string[] | null | undefined
): DonationEvent[] {
  if (!logs) return [];

  const events: DonationEvent[] = [];
  for (const line of logs) {
    const at = line.indexOf(PROGRAM_DATA_PREFIX);
    if (at === -1) continue;

    const payload = line.slice(at + PROGRAM_DATA_PREFIX.length).trim();
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(base64Encoder.encode(payload));
    } catch {
      continue; // not base64 — some other program's log line
    }

    if (!startsWithDiscriminator(bytes)) continue;

    try {
      events.push(
        donationEventDecoder.decode(bytes.subarray(8)) as DonationEvent
      );
    } catch {
      // A truncated or malformed record should never take down the overlay.
    }
  }
  return events;
}
