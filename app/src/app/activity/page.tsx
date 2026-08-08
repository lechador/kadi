import type { Metadata } from "next";

import { ActivityView } from "@/components/ActivityView";
import { isDatabaseConfigured } from "@/lib/db/client";
import { loadRecentDonations } from "@/lib/server/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "აქტივობა — Kadi",
  description:
    "პროტოკოლის ყველა დონაცია, ახლიდან ძველისკენ. თითოეული ჩანაწერი საჯარო ტრანზაქციაა.",
};

export default async function ActivityPage() {
  const donations = await loadRecentDonations({ limit: 60 });

  return (
    <ActivityView
      initial={donations.data}
      available={isDatabaseConfigured()}
    />
  );
}
