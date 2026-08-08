import "server-only";

import {
  CATEGORIES,
  DEFAULT_OVERLAY_SETTINGS,
  type OverlaySettingsView,
  type ProfileView,
} from "../views";

/// Normalisers for everything a creator can type into the off-chain half of
/// the app. Each one returns a value the database is happy to store and the
/// page is safe to render, or null — no field here is important enough to
/// reject a whole save over.

function trimmed(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

/// Only `http:` and `https:` survive.
///
/// These values end up in `src` and `href` attributes, where a `javascript:`
/// or `data:` URL is script execution in the visitor's session. Parsing with
/// `URL` and checking the protocol is what makes that impossible, rather than
/// pattern-matching the string.
export function safeUrl(value: unknown, max = 500): string | null {
  const text = trimmed(value, max);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().slice(0, max);
  } catch {
    return null;
  }
}

/// A social identity, not a URL: `@name`, a pasted profile link and a bare
/// handle all reduce to the same stored value, so the UI can build the link.
export function socialHandle(value: unknown): string | null {
  const text = trimmed(value, 100);
  if (!text) return null;

  const last = text.replace(/\/+$/, "").split("/").pop() ?? text;
  const cleaned = last.replace(/^@/, "").trim();

  return /^[A-Za-z0-9_.\-]{1,64}$/.test(cleaned) ? cleaned : null;
}

export function hexColour(value: unknown, fallback: string | null = null): string | null {
  const text = trimmed(value, 9);
  if (!text) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : fallback;
}

export function category(value: unknown): string | null {
  const text = trimmed(value, 32);
  if (!text) return null;
  return (CATEGORIES as readonly string[]).includes(text) ? text : null;
}

export function parseProfile(body: unknown): ProfileView {
  const input = (body ?? {}) as Record<string, unknown>;
  return {
    bannerUrl: safeUrl(input.bannerUrl),
    avatarUrl: safeUrl(input.avatarUrl),
    about: trimmed(input.about, 2_000),
    category: category(input.category),
    location: trimmed(input.location, 80),
    website: safeUrl(input.website),
    twitter: socialHandle(input.twitter),
    youtube: socialHandle(input.youtube),
    twitch: socialHandle(input.twitch),
    instagram: socialHandle(input.instagram),
    tiktok: socialHandle(input.tiktok),
    discord: trimmed(input.discord, 100),
    accent: hexColour(input.accent),
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function baseUnits(value: unknown): string {
  // Stored as a decimal string so it lands in `numeric` without ever passing
  // through a float. A u64 of lamports does not survive Number.
  if (typeof value === "bigint") return value.toString();
  const text = String(value ?? "0").trim();
  return /^\d{1,20}$/.test(text) ? text : "0";
}

export function parseOverlaySettings(body: unknown): OverlaySettingsView {
  const input = (body ?? {}) as Record<string, unknown>;
  return {
    accent: hexColour(input.accent, DEFAULT_OVERLAY_SETTINGS.accent)!,
    // Under a second is unreadable; over half a minute an alert queue during a
    // donation train would fall minutes behind the stream.
    alertDurationMs: clampInt(input.alertDurationMs, 1_000, 30_000, 5_200),
    minAmount: baseUnits(input.minAmount),
    soundEnabled: input.soundEnabled === true,
    soundUrl: safeUrl(input.soundUrl),
    ttsEnabled: input.ttsEnabled === true,
    ttsVoice: trimmed(input.ttsVoice, 120),
    ttsRate: Math.min(Math.max(Number(input.ttsRate) || 1, 0.5), 2),
    showBar: input.showBar !== false,
    pinnedGoalIndex:
      input.pinnedGoalIndex === null || input.pinnedGoalIndex === undefined || input.pinnedGoalIndex === ""
        ? null
        : clampInt(input.pinnedGoalIndex, 0, 1_000_000, 0),
    alertHeading: trimmed(input.alertHeading, 60),
  };
}
