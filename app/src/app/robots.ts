import type { MetadataRoute } from "next";

import { APP_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The overlay is a transparent OBS browser source and the API is not a
      // page; neither belongs in a search result.
      disallow: ["/api/", "/overlay/", "/dashboard"],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
