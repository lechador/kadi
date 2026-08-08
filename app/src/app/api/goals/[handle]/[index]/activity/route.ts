import { NextResponse } from "next/server";

import { loadGoal, loadGoalDonations, loadGoalSupporters } from "@/lib/server/data";

/// The goal page's ledger and leaderboard, refetched after a donation lands.
///
/// A route rather than a server action because the page also calls it from a
/// log-subscription callback, where there is no form submission and no
/// navigation to hang a revalidation off.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ handle: string; index: string }> };

export async function GET(_request: Request, context: Context) {
  const { handle, index } = await context.params;
  const parsed = Number(index);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return NextResponse.json({ error: "Invalid goal index" }, { status: 400 });
  }

  const { data: goal } = await loadGoal(handle, parsed);
  if (!goal) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const [donations, supporters] = await Promise.all([
    loadGoalDonations(goal.address, 20),
    loadGoalSupporters(goal.address, 10),
  ]);

  return NextResponse.json({
    donations: donations.data,
    supporters: supporters.data,
  });
}
