import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getPost } from "@/lib/queries/post";
import { OG_SIZE, ogCard } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Amin Solahuddin";

/**
 * The share card for one post. §9.
 *
 * Generated on demand so a post published from the admin panel has a card the
 * moment it goes live, rather than after the next deploy.
 */
export default async function Image({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  const locale = hasLocale(routing.locales, params.locale)
    ? params.locale
    : routing.defaultLocale;

  const post = await getPost(params.slug, locale);

  /**
   * A missing post still returns an image rather than throwing.
   *
   * This route can be hit for a slug that has been unpublished, and a scraper
   * that gets a 500 here may cache the failure and show a broken preview for the
   * URL long after the page itself is fine again.
   */
  return new ImageResponse(
    ogCard({
      title: post?.title ?? "Amin Solahuddin",
      kicker: "Writing",
    }),
    size,
  );
}
