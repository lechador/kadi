import { LandingView } from "@/components/LandingView";
import {
  loadConfig,
  loadGoals,
  loadRecentDonations,
  loadStats,
} from "@/lib/server/data";

/// Server-rendered from the indexed cache.
///
/// This page used to open a `getProgramAccounts` scan from the visitor's
/// browser, which is the single call hosted RPC providers throttle hardest —
/// the landing page got slower the more successful the protocol became. Now the
/// numbers come from Postgres and the page arrives complete, which also means
/// a crawler sees the goals instead of an empty shell.
///
/// It does not re-read the chain in the browser afterwards, and that is the
/// deliberate part: nothing here is a number anyone is about to act on. The
/// goal page, where a donor is about to send money, does revalidate.

export const revalidate = 20;

export default async function LandingPage() {
  const [stats, goals, recent, config] = await Promise.all([
    loadStats(),
    loadGoals({ status: "active", sort: "trending", limit: 9 }),
    loadRecentDonations({ limit: 12 }),
    loadConfig().catch(() => null),
  ]);

  return (
    <LandingView
      stats={stats.data}
      goals={goals.data}
      recent={recent.data}
      feeBps={config?.feeBps ?? 250}
      source={stats.source}
    />
  );
}
