import type { Metadata } from "next";

import { GoalMissing, GoalPageView } from "@/components/GoalPageView";
import { APP_URL } from "@/lib/config";
import { formatTokenAmount, percent } from "@/lib/format";
import {
  loadConfig,
  loadCreator,
  loadGoal,
  loadGoalDonations,
  loadGoalSupporters,
} from "@/lib/server/data";
import { tokenFor } from "@/lib/tokens";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ handle: string; index: string }> };

function parseIndex(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function generateMetadata(context: Context): Promise<Metadata> {
  const { handle, index } = await context.params;
  const parsed = parseIndex(index);
  if (parsed === null) return { title: "Kadi", robots: { index: false } };

  const { data: goal } = await loadGoal(handle, parsed).catch(() => ({
    data: null,
  }));
  if (!goal) {
    return { title: "მიზანი ვერ მოიძებნა — Kadi", robots: { index: false } };
  }

  const token = tokenFor(goal.mint);
  const share = Math.round(percent(BigInt(goal.raised), BigInt(goal.target)));
  const description =
    goal.description ||
    `${formatTokenAmount(BigInt(goal.raised), token.decimals)} / ${formatTokenAmount(
      BigInt(goal.target),
      token.decimals
    )} ${token.symbol} შეგროვდა (${share}%). მხარი დაუჭირე ${goal.creatorName}-ს.`;

  const url = `${APP_URL}/goal/${goal.handle}/${goal.index}`;
  const image = `/api/og/goal/${goal.handle}/${goal.index}`;

  return {
    title: `${goal.title} — ${goal.creatorName} — Kadi`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: `${goal.title} — ${goal.creatorName}`,
      description,
      url,
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${goal.title} — ${goal.creatorName}`,
      description,
      images: [image],
    },
  };
}

export default async function GoalPage(context: Context) {
  const { handle, index } = await context.params;
  const parsed = parseIndex(index);
  if (parsed === null) return <GoalMissing />;

  const { data: goal } = await loadGoal(handle, parsed);
  if (!goal) return <GoalMissing />;

  const [donations, supporters, config, creator] = await Promise.all([
    loadGoalDonations(goal.address, 20),
    loadGoalSupporters(goal.address, 10),
    loadConfig().catch(() => null),
    loadCreator(handle),
  ]);

  return (
    <GoalPageView
      goal={goal}
      creatorName={
        creator.data?.displayName || goal.creatorName || `@${goal.handle}`
      }
      donations={donations.data}
      supporters={supporters.data}
      config={config}
    />
  );
}
