import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/**
 * The `alternates` block for one localised page. BUILD_PLAN.md §4 and §11.
 *
 * One helper rather than the same Object.fromEntries incantation copied into
 * every page, and the copying is what made this necessary: the feed link was
 * added to the layout, and every page that declared its own `alternates` for
 * canonical and hreflang silently dropped it. Next replaces the whole
 * `alternates` object when a page defines one — it does not merge into it.
 *
 * Rendering a <link> from the layout instead looked like the way around that.
 * It is not: React hoists metadata elements out of the tree on its own schedule,
 * and in practice the tag appeared on some pages and not others across otherwise
 * identical renders. A discovery link that is present most of the time is worse
 * than one built the boring way, every time, from here.
 *
 * @param path the locale-less path, leading slash, e.g. "/writing/some-post"
 */
export function localeAlternates(
  locale: string,
  path: string,
  siteName = "Amin Solahuddin",
): Metadata["alternates"] {
  return {
    // §4: canonical points at the page's own locale URL, never at English.
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])),
      // §4: x-default points at the English version.
      "x-default": `/${routing.defaultLocale}${path}`,
    },
    types: {
      "application/rss+xml": [
        { url: `/${locale}/feed.xml`, title: siteName },
      ],
    },
  };
}
