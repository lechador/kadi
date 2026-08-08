import { LAMPORTS_PER_SOL } from "./config";

/// Formats lamports as SOL without floating-point rounding: the integer and
/// fractional parts are derived with bigint arithmetic, so large balances stay
/// exact.
export function formatSol(lamports: bigint, maxDecimals = 4): string {
  const negative = lamports < 0n;
  const abs = negative ? -lamports : lamports;

  const whole = abs / LAMPORTS_PER_SOL;
  const remainder = abs % LAMPORTS_PER_SOL;

  let fraction = remainder.toString().padStart(9, "0").slice(0, maxDecimals);
  fraction = fraction.replace(/0+$/, "");

  const body = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${body}` : body;
}

/// Parses a decimal string into the token's base units. Returns null for
/// anything that is not a plain non-negative decimal, so callers can
/// distinguish "invalid" from "zero".
export function parseTokenAmount(
  input: string,
  decimals: number
): bigint | null {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    return null;
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const base = 10n ** BigInt(decimals);
  const padded = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(whole || "0") * base + BigInt(padded || "0");
}

export function solToLamports(input: string): bigint | null {
  return parseTokenAmount(input, 9);
}

/// Token amounts carry their own decimals (USDC uses 6, not 9).
export function formatTokenAmount(amount: bigint, decimals: number): string {
  if (decimals === 0) return amount.toString();
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function percent(raised: bigint, target: bigint): number {
  if (target <= 0n) return 0;
  // Scale before dividing so integer division does not floor everything to 0.
  const scaled = Number((raised * 10_000n) / target) / 100;
  return Math.min(scaled, 100);
}

export function timeAgo(unixSeconds: number | bigint, language: "ka" | "en" = "en"): string {
  const seconds = Math.floor(Date.now() / 1000) - Number(unixSeconds);
  if (seconds < 60) return language === "ka" ? "ახლახან" : "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return language === "ka" ? `${minutes} წთ-ის წინ` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return language === "ka" ? `${hours} სთ-ის წინ` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return language === "ka" ? `${days} დღის წინ` : `${days}d ago`;
  return new Date(Number(unixSeconds) * 1000).toLocaleDateString(language === "ka" ? "ka-GE" : "en-US");
}

export function formatDeadline(deadline: bigint | null, language: "ka" | "en" = "en"): string | null {
  if (deadline === null) return null;
  const remaining = Number(deadline) - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return language === "ka" ? "დასრულდა" : "ended";
  const days = Math.floor(remaining / 86_400);
  if (days >= 1) return language === "ka" ? `დარჩა ${days} დღე` : `${days}d left`;
  const hours = Math.floor(remaining / 3_600);
  if (hours >= 1) return language === "ka" ? `დარჩა ${hours} საათი` : `${hours}h left`;
  const minutes = Math.max(1, Math.floor(remaining / 60));
  return language === "ka" ? `დარჩა ${minutes} წუთი` : `${minutes}m left`;
}

const HANDLE_PATTERN = /^[a-z0-9_]{3,32}$/;

/// Mirrors `is_valid_handle` in the program so the UI can reject a bad handle
/// before it costs the user a failed transaction.
export function isValidHandle(handle: string): boolean {
  return HANDLE_PATTERN.test(handle);
}
