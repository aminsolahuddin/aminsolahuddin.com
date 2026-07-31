import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /**
         * These are 404 to anyone without a session, so disallowing them adds no
         * protection — requireAdmin() is the protection. It is here to stop
         * crawlers spending their budget on paths that will never return content,
         * and to stop /r/ short links being followed and logged as traffic that
         * no person generated. §5's hit table is for attribution, and a crawler
         * walking every slug would make it lie.
         */
        disallow: ["/admin", "/api/", "/r/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
