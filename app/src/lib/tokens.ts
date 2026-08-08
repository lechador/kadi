import type { Address } from "@solana/kit";

import { CHAIN } from "./config";

export type TokenInfo = {
  mint: Address;
  symbol: string;
  name: string;
  decimals: number;
};

/// `Pubkey::default()` in base58 — the sentinel a goal uses for native SOL.
export const NATIVE_MINT_SENTINEL =
  "11111111111111111111111111111111" as Address;

export const SOL_TOKEN: TokenInfo = {
  mint: NATIVE_MINT_SENTINEL,
  symbol: "SOL",
  name: "Solana",
  decimals: 9,
};

/// Circle's canonical USDC mints. Localnet has no USDC, so the seed script
/// creates a stand-in from a fixed keypair and its address is supplied through
/// NEXT_PUBLIC_USDC_MINT.
const USDC_BY_CLUSTER: Record<string, string | undefined> = {
  "solana:mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "solana:devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "solana:localnet": process.env.NEXT_PUBLIC_USDC_MINT,
};

const configuredUsdc = process.env.NEXT_PUBLIC_USDC_MINT ?? USDC_BY_CLUSTER[CHAIN];

export const USDC_TOKEN: TokenInfo | null = configuredUsdc
  ? {
      mint: configuredUsdc as Address,
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
    }
  : null;

/// Denominations a creator may pick when opening a goal.
export const SUPPORTED_TOKENS: TokenInfo[] = USDC_TOKEN
  ? [SOL_TOKEN, USDC_TOKEN]
  : [SOL_TOKEN];

export function isNativeMint(mint: Address | string): boolean {
  return mint === NATIVE_MINT_SENTINEL;
}

/// Resolves a goal's mint to display metadata. Unknown mints still render
/// correctly — they just show a shortened address instead of a symbol.
export function tokenFor(mint: Address | string): TokenInfo {
  if (isNativeMint(mint)) return SOL_TOKEN;

  const known = SUPPORTED_TOKENS.find((token) => token.mint === mint);
  if (known) return known;

  return {
    mint: mint as Address,
    symbol: `${String(mint).slice(0, 4)}…`,
    name: "Unknown token",
    // Best-effort default. Callers that need exactness read the mint account;
    // this only affects how an unrecognised token is formatted.
    decimals: 6,
  };
}
