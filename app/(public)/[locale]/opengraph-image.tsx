import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { OG_SIZE, ogCard } from "@/lib/og";

/**
 * BUILD_PLAN.md §9: "OG images generated at build or on demand with next/og,
 * styled from DESIGN.md."
 *
 * On demand rather than at build. A pack published from the admin panel has to
 * have a share card immediately, and a build-time image would mean redeploying
 * to get one — which is the same argument that made these pages force-dynamic.
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Amin Solahuddin";

export default async function Image({
  params,
}: {
  params: { locale: string };
}) {
  const locale = hasLocale(routing.locales, params.locale)
    ? params.locale
    : routing.defaultLocale;

  const t = await getTranslations({ locale, namespace: "home" });
  const meta = await getTranslations({ locale, namespace: "meta" });

  return new ImageResponse(
    ogCard({ title: t("headline"), kicker: meta("siteName") }),
    size,
  );
}
