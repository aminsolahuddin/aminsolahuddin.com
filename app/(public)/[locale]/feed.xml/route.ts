import { NextResponse } from "next/server";
import { hasLocale } from "next-intl";

import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/env";
import { listPosts } from "@/lib/queries/post";
import { listRepos } from "@/lib/queries/repo-entry";

/**
 * BUILD_PLAN.md §11: "One feed per locale, covering posts and new repo entries.
 * Cheap to build and developers still use it."
 *
 * Both content types in one feed rather than two, because a reader subscribing
 * to this site wants to know when something new appears, not to keep track of
 * which of two feeds carries which kind of thing.
 */
export const dynamic = "force-dynamic";

/** Enough to be useful in a reader, small enough not to be a page of its own. */
const MAX_ITEMS = 40;

/**
 * XML escaping, applied to every interpolated value without exception.
 *
 * A one-liner containing an ampersand — "types & runtime validation" — produces
 * XML that a strict parser rejects outright, and the reader shows the whole feed
 * as broken rather than that one entry. `&` has to be first or it would
 * re-escape the ampersands the later replacements introduce.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale } = await context.params;
  if (!hasLocale(routing.locales, locale)) {
    return new NextResponse(null, { status: 404 });
  }

  const base = getSiteUrl();

  const [posts, repos] = await Promise.all([
    listPosts(locale),
    listRepos(locale),
  ]);

  type Entry = {
    title: string;
    link: string;
    description: string;
    date: Date;
    guid: string;
  };

  const entries: Entry[] = [
    ...posts.flatMap((post) =>
      post.publishedAt
        ? [
            {
              title: post.title,
              link: `${base}/${locale}/writing/${post.slug}`,
              description: post.excerpt ?? "",
              date: post.publishedAt,
              /**
               * The guid is locale-independent so a reader following two locales
               * does not see the same post twice. It is also permanent: readers
               * key "already seen" on it, and changing it re-notifies everyone
               * about something they read months ago.
               */
              guid: `${base}/writing/${post.slug}`,
            },
          ]
        : [],
    ),
    ...repos.flatMap((repo) =>
      /**
       * Dated by publication, and entries with no date are left out rather than
       * dated "now". A feed item stamped with the current time floats to the top
       * of every reader on every fetch, which is how a feed becomes noise.
       */
      repo.publishedAt
        ? [
            {
              title: `${repo.owner}/${repo.name}`,
              link: `${base}/${locale}/repos/${repo.owner}/${repo.name}`,
              description: repo.oneLiner,
              date: repo.publishedAt,
              guid: `${base}/repos/${repo.owner}/${repo.name}`,
            },
          ]
        : [],
    ),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, MAX_ITEMS);

  const self = `${base}/${locale}/feed.xml`;
  const updated = entries[0]?.date ?? new Date();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml("Amin Solahuddin")}</title>
    <link>${xml(`${base}/${locale}`)}</link>
    <description>${xml("Code from the videos, and the notes that go with it.")}</description>
    <language>${xml(locale)}</language>
    <lastBuildDate>${updated.toUTCString()}</lastBuildDate>
    <atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>
${entries
  .map(
    (entry) => `    <item>
      <title>${xml(entry.title)}</title>
      <link>${xml(entry.link)}</link>
      <guid isPermaLink="false">${xml(entry.guid)}</guid>
      <pubDate>${entry.date.toUTCString()}</pubDate>
      <description>${xml(entry.description)}</description>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Readers poll hard. An hour of caching costs a subscriber nothing and
      // spares the database a query per reader per poll.
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
