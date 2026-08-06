import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";
import { getPublishedPackSlugs } from "@/lib/queries/resource-pack";
import { getPublishedRepoPaths } from "@/lib/queries/repo-entry";
import { getPublishedPostSlugs } from "@/lib/queries/post";

/**
 * BUILD_PLAN.md §9: "Sitemap includes lastmod from updated_at."
 * §4: "Sitemap lists every locale variant of every published entity."
 *
 * Both queries this leans on were written during Phases 1 and 2 and then never
 * called — dead code that would have been wrong by the time anyone used it. This
 * is what they were for.
 */
export const dynamic = "force-dynamic";

/**
 * Every locale variant of one path, cross-linked with the others.
 *
 * `alternates.languages` is what stops the three locale copies of a page reading
 * as duplicate content. Without it a crawler sees /en/writing/x and /ms/writing/x
 * as two pages saying nearly the same thing, and picks one — usually not the one
 * the reader wanted.
 */
function localised(
  path: string,
  lastModified: Date,
  priority: number,
): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const languages = Object.fromEntries(
    routing.locales.map((l) => [l, `${base}/${l}${path}`]),
  );

  return routing.locales.map((locale) => ({
    url: `${base}/${locale}${path}`,
    lastModified,
    priority,
    alternates: {
      languages: {
        ...languages,
        "x-default": `${base}/${routing.defaultLocale}${path}`,
      },
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [packs, repos, posts] = await Promise.all([
    getPublishedPackSlugs(),
    getPublishedRepoPaths(),
    getPublishedPostSlugs(),
  ]);

  const now = new Date();

  const staticPages = ["", "/resources", "/repos", "/writing", "/tools"].flatMap(
    (path) => localised(path, now, path === "" ? 1 : 0.8),
  );

  /**
   * Listed, but low priority. §10's disclosure and privacy pages exist to be
   * found by a reader who is already here and wants to check something, not to
   * compete for search traffic — and /about is a bio, not an answer to a query.
   */
  const infoPages = ["/about", "/disclosure", "/privacy"].flatMap((path) =>
    localised(path, now, 0.3),
  );

  /**
   * Content pages carry their own updated_at rather than today's date.
   *
   * A sitemap that stamps everything with "now" on every crawl is telling a
   * crawler that the entire site changed today, every day. It learns to ignore
   * lastmod, and then the field is worth nothing on the one page that did change.
   */
  const packPages = packs.flatMap((pack) =>
    localised(`/resources/${pack.slug}`, pack.updatedAt, 0.7),
  );

  const repoPages = repos.flatMap((repo) =>
    localised(`/repos/${repo.owner}/${repo.name}`, repo.updatedAt, 0.6),
  );

  const postPages = posts.flatMap((post) =>
    localised(`/writing/${post.slug}`, post.updatedAt, 0.7),
  );

  return [...staticPages, ...packPages, ...repoPages, ...postPages, ...infoPages];
}
