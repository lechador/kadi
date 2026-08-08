import type { Metadata } from "next";

import { CreatorMissing, CreatorPageView } from "@/components/CreatorPageView";
import { APP_URL } from "@/lib/config";
import { loadCreator, loadCreatorGoals } from "@/lib/server/data";

/// A creator's public page, rendered on the server.
///
/// The reason this had to move off the client is not speed: it is that a
/// donation page nobody can preview in a chat app is a donation page that does
/// not get shared. Title, description and a generated card now exist before
/// any JavaScript runs.

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ handle: string }> };

export async function generateMetadata(context: Context): Promise<Metadata> {
  const { handle } = await context.params;
  const { data: creator } = await loadCreator(handle).catch(() => ({
    data: null,
  }));

  if (!creator) {
    return {
      title: `@${handle} — Kadi`,
      description: `@${handle} ჯერ არ არის დარეგისტრირებული Kadi-ზე.`,
      robots: { index: false },
    };
  }

  const name = creator.displayName || `@${creator.handle}`;
  const description =
    creator.profile?.about?.slice(0, 200) ||
    creator.bio ||
    `მხარი დაუჭირე ${name}-ს პირდაპირ, Solana-ზე. 97.5% რჩება კრეატორს.`;

  return {
    title: `${name} (@${creator.handle}) — Kadi`,
    description,
    alternates: { canonical: `${APP_URL}/c/${creator.handle}` },
    openGraph: {
      type: "profile",
      title: `${name} — Kadi`,
      description,
      url: `${APP_URL}/c/${creator.handle}`,
      images: [{ url: `/api/og/creator/${creator.handle}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} — Kadi`,
      description,
      images: [`/api/og/creator/${creator.handle}`],
    },
  };
}

export default async function CreatorPage(context: Context) {
  const { handle } = await context.params;
  const { data: creator } = await loadCreator(handle);

  if (!creator) return <CreatorMissing handle={handle} />;

  const goals = await loadCreatorGoals(creator);
  return <CreatorPageView creator={creator} goals={goals.data} />;
}
