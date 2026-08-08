/// Single place every environment-dependent value is read from.

export const BRAND = {
  name: "Kadi",
  /// ნაკადი — "stream/flow" in Georgian: both a livestream and a flow of funds.
  tagline: "Donations that reach creators whole.",
} as const;

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899";

export const WS_URL =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ?? "ws://127.0.0.1:8900";

export const CHAIN = (process.env.NEXT_PUBLIC_SOLANA_CHAIN ??
  "solana:localnet") as `solana:${string}`;

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/// The fee kisa.ge charges today (5% platform + 2.5% bank), used for the
/// side-by-side comparison on the landing page.
export const INCUMBENT_FEE_BPS = 750;

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export function explorerTx(signature: string): string {
  const cluster = CHAIN.split(":")[1];
  const suffix =
    cluster === "mainnet"
      ? ""
      : cluster === "localnet"
        ? `?cluster=custom&customUrl=${encodeURIComponent(RPC_URL)}`
        : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}
