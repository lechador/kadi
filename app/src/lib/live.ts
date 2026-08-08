"use client";

import { useEffect, useRef, useState } from "react";

import { KADI_PROGRAM_ADDRESS } from "@/generated";
import { parseDonationEvents, type DonationEvent } from "./events";
import { useKadiClient } from "./hooks";
import type { DonationView } from "./views";

/// A live subscription to the program's logs.
///
/// This is the part of Kadi that never went through a database and still does
/// not: the alert on a creator's stream comes from the RPC's log feed, not
/// from a webhook or a poll against a table. The cache is downstream of it.

export type LiveDonation = DonationView & { live: true };

function toView(event: DonationEvent, signature: string): LiveDonation {
  return {
    signature,
    eventIndex: 0,
    goalAddress: event.goal,
    creatorAddress: event.creator,
    handle: null,
    goalTitle: null,
    goalIndex: null,
    donor: event.donor,
    mint: event.mint,
    amount: event.amount.toString(),
    net: event.net.toString(),
    fee: event.fee.toString(),
    message: event.message,
    isFirstTime: event.isFirstTime,
    timestamp: Number(event.timestamp),
    live: true,
  };
}

/// Tells the server to index a transaction it may not have seen yet.
///
/// Deliberately fire-and-forget. A donation that arrives by Solana Pay QR has
/// no browser of its own to report it, so whichever page is watching the log
/// feed — usually the creator's own overlay, which runs for the length of a
/// stream — closes that gap. The insert is idempotent, so several watchers
/// reporting the same signature costs one row.
export function reportSignature(signature: string): void {
  void fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature }),
  }).catch(() => {});
}

/// Fills in what the log event cannot carry.
///
/// A `DonationEvent` holds addresses, not handles — the program has no reason
/// to emit a string it already stores in an account. So a donation that arrives
/// on the socket knows which creator PDA it belongs to but not what to call it,
/// while the indexed rows already on the page know both. Matching one against
/// the other costs nothing and means a live row is not visibly poorer than the
/// row it becomes a second later.
export function withKnownCreators<T extends DonationView>(
  donations: T[],
  known: DonationView[]
): T[] {
  const byCreator = new Map<string, { handle: string | null }>();
  for (const donation of known) {
    if (donation.handle) byCreator.set(donation.creatorAddress, donation);
  }

  return donations.map((donation) =>
    donation.handle
      ? donation
      : { ...donation, handle: byCreator.get(donation.creatorAddress)?.handle ?? null }
  );
}

export type LiveOptions = {
  /// Restrict to one creator's donations. Used by the overlay, which must not
  /// fire an alert for somebody else's stream.
  creatorAddress?: string | null;
  /// Report each new signature to the indexer.
  report?: boolean;
  onDonation?: (donation: LiveDonation) => void;
};

export function useLiveDonations(options: LiveOptions = {}) {
  const { creatorAddress = null, report = false, onDonation } = options;
  const client = useKadiClient();

  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState<LiveDonation[]>([]);

  // Kept in a ref so a caller can pass an inline callback without the
  // subscription tearing down and re-establishing on every render.
  const handler = useRef(onDonation);
  handler.current = onDonation;

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const notifications = await client.rpcSubscriptions
          .logsNotifications(
            { mentions: [KADI_PROGRAM_ADDRESS] },
            { commitment: "confirmed" }
          )
          .subscribe({ abortSignal: controller.signal });

        setConnected(true);

        for await (const notification of notifications) {
          const signature = notification.value.signature;
          const donations = parseDonationEvents(notification.value.logs)
            .filter(
              (event) => !creatorAddress || event.creator === creatorAddress
            )
            .map((event) => toView(event, signature));

          if (donations.length === 0) continue;
          if (report) reportSignature(signature);

          setLatest((current) => [...donations, ...current].slice(0, 40));
          for (const donation of donations) handler.current?.(donation);
        }
      } catch {
        if (!controller.signal.aborted) setConnected(false);
      }
    })();

    return () => controller.abort();
  }, [client, creatorAddress, report]);

  return { connected, latest };
}
