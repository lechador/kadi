import type { MetadataRoute } from "next";

import { APP_URL } from "@/lib/config";
import { isDatabaseConfigured } from "@/lib/db/client";
import { listSitemapEntries } from "@/lib/db/read";

/// Every creator and goal page, enumerated.
///
/// This is the second thing the index made possible: listing the URLs a
/// crawler should visit required knowing every handle, which used to mean a
/// `getProgramAccounts` scan on every request for /sitemap.xml.

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: APP_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${APP_URL}/explore`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${APP_URL}/activity`, changeFrequency: "hourly", priority: 0.6 },
    { url: `${APP_URL}/dashboard`, changeFrequency: "monthly", priority: 0.4 },
  ];

  if (!isDatabaseConfigured()) return staticRoutes;

  try {
    const { creators, goals } = await listSitemapEntries();
    return [
      ...staticRoutes,
      ...creators.map((creator) => ({
        url: `${APP_URL}/c/${creator.handle}`,
        lastModified: creator.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...goals.map((goal) => ({
        url: `${APP_URL}/goal/${goal.handle}/${goal.index}`,
        lastModified: goal.updatedAt,
        changeFrequency: "hourly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    return staticRoutes;
  }
}
