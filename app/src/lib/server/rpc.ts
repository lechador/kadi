import "server-only";

import { createSolanaRpc } from "@solana/kit";

import { RPC_URL } from "../config";
import type { KadiRpc } from "../queries";

/// The endpoint the server talks to, which is not necessarily the one the
/// browser does. `getProgramAccounts` and a signature walk are exactly the
/// calls public RPCs throttle first, so the indexer wants the paid endpoint —
/// and that URL should never be shipped to the client, which is why it is read
/// from a variable without the `NEXT_PUBLIC_` prefix.
export const SERVER_RPC_URL = process.env.SOLANA_RPC_URL ?? RPC_URL;

export function serverRpc(): KadiRpc {
  return createSolanaRpc(SERVER_RPC_URL) as unknown as KadiRpc;
}
