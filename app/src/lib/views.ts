/// The shapes that cross the server → client boundary.
///
/// Everything on the chain is a `u64`, which no JSON serialiser and no React
/// Server Component payload carries safely, so amounts travel as decimal
/// strings and become bigints again on arrival. Timestamps travel as Unix
/// seconds, which is what the chain and the existing formatters already speak.
///
/// This module holds no database or RPC code on purpose: both server pages and
/// client components import it, so it must stay free of anything that only
/// runs in one of them.

export type ProfileView = {
  bannerUrl: string | null;
  avatarUrl: string | null;
  about: string | null;
  category: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  youtube: string | null;
  twitch: string | null;
  instagram: string | null;
  tiktok: string | null;
  discord: string | null;
  accent: string | null;
};

export type CreatorView = {
  address: string;
  owner: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUri: string;
  goalCount: number;
  createdAt: number;
  profile: ProfileView | null;
};

export type GoalView = {
  address: string;
  creatorAddress: string;
  handle: string;
  creatorName: string;
  creatorAvatar: string | null;
  index: number;
  title: string;
  description: string;
  mint: string;
  target: string;
  raised: string;
  claimed: string;
  donationCount: number;
  supporterCount: number;
  status: number;
  deadline: number | null;
  createdAt: number;
};

export type DonationView = {
  signature: string;
  eventIndex: number;
  goalAddress: string;
  creatorAddress: string;
  handle: string | null;
  goalTitle: string | null;
  goalIndex: number | null;
  donor: string;
  mint: string;
  amount: string;
  net: string;
  fee: string;
  message: string;
  isFirstTime: boolean;
  timestamp: number;
};

export type SupporterView = {
  donor: string;
  total: string;
  count: number;
  lastAt: number;
};

export type StatsView = {
  totalRaised: string;
  totalFees: string;
  donationCount: number;
  creatorCount: number;
  goalCount: number;
  activeGoalCount: number;
  supporterCount: number;
};

export type OverlaySettingsView = {
  accent: string;
  alertDurationMs: number;
  minAmount: string;
  soundEnabled: boolean;
  soundUrl: string | null;
  ttsEnabled: boolean;
  ttsVoice: string | null;
  ttsRate: number;
  showBar: boolean;
  pinnedGoalIndex: number | null;
  alertHeading: string | null;
};

export type DailyPointView = {
  day: string;
  amount: string;
  count: number;
};

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettingsView = {
  accent: "#c63d2f",
  alertDurationMs: 5200,
  minAmount: "0",
  soundEnabled: false,
  soundUrl: null,
  ttsEnabled: false,
  ttsVoice: null,
  ttsRate: 1,
  showBar: true,
  pinnedGoalIndex: null,
  alertHeading: null,
};

/// The categories a creator can file their page under. Kept as a closed list
/// rather than free text so the explore filter stays a set of real buckets
/// instead of a long tail of one-off spellings.
export const CATEGORIES = [
  "streaming",
  "music",
  "art",
  "gaming",
  "education",
  "journalism",
  "sport",
  "tech",
  "community",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(value: string | null | undefined): value is Category {
  return !!value && (CATEGORIES as readonly string[]).includes(value);
}

/// `progress` rather than a raw "most raised": goals are denominated in
/// different tokens, so ordering by absolute amount would rank 1 SOL above
/// 100 USDC. Share of target is the only comparison that holds across mints.
export const SORT_OPTIONS = ["trending", "newest", "progress", "ending"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export function isSortOption(value: string | null | undefined): value is SortOption {
  return !!value && (SORT_OPTIONS as readonly string[]).includes(value);
}
