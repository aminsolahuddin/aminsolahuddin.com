import "server-only";

import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { getDb } from "@/db";
import { post, postI18n } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locales";

/**
 * BUILD_PLAN.md §3 and §12, Phase 3.
 *
 * Same shape as every other content type here: facts on `post`, prose on
 * `post_i18n`, and a missing translation renders the English row and says so
 * rather than machine-translating or showing a half-empty page.
 */

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string | null;
  translated: boolean;
  hasAffiliate: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}

export interface PostDetail extends PostSummary {
  bodyMd: string | null;
  reviewedAt: Date | null;
}

function pick<T extends { locale: string }>(
  rows: T[],
  locale: Locale,
): { row: T; translated: boolean } | null {
  const exact = rows.find((r) => r.locale === locale);
  if (exact) return { row: exact, translated: true };

  const base = rows.find((r) => r.locale === DEFAULT_LOCALE);
  if (base) return { row: base, translated: locale === DEFAULT_LOCALE };

  return null;
}

/**
 * Published posts, newest first.
 *
 * Ordered by `published_at`, not `updated_at`. A typo fixed in a two-year-old
 * post is not news, and sorting by the last edit would push it to the top of the
 * index every time somebody corrected a word.
 */
export async function listPosts(locale: Locale): Promise<PostSummary[]> {
  const db = getDb();
  const locales =
    locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];

  const rows = await db
    .select({
      id: post.id,
      slug: post.slug,
      hasAffiliate: post.hasAffiliate,
      publishedAt: post.publishedAt,
      updatedAt: post.updatedAt,
    })
    .from(post)
    .where(and(eq(post.status, "published"), isNotNull(post.publishedAt)))
    .orderBy(desc(post.publishedAt));

  if (rows.length === 0) return [];

  const text = await db
    .select()
    .from(postI18n)
    .where(
      and(
        inArray(
          postI18n.postId,
          rows.map((r) => r.id),
        ),
        inArray(postI18n.locale, locales),
      ),
    );

  const byPost = new Map<string, typeof text>();
  for (const row of text) {
    const list = byPost.get(row.postId);
    if (list) list.push(row);
    else byPost.set(row.postId, [row]);
  }

  return rows.flatMap((row) => {
    const chosen = pick(byPost.get(row.id) ?? [], locale);
    // No English row means no title in any language a reader could be shown.
    if (!chosen) return [];

    return [
      {
        slug: row.slug,
        title: chosen.row.title,
        excerpt: chosen.row.excerpt,
        translated: chosen.translated,
        hasAffiliate: row.hasAffiliate,
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
      },
    ];
  });
}

export async function getPost(
  slug: string,
  locale: Locale,
): Promise<PostDetail | null> {
  const db = getDb();
  const locales =
    locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];

  const [row] = await db
    .select()
    .from(post)
    .where(and(eq(post.slug, slug), eq(post.status, "published")))
    .limit(1);

  if (!row) return null;

  const text = await db
    .select()
    .from(postI18n)
    .where(
      and(eq(postI18n.postId, row.id), inArray(postI18n.locale, locales)),
    );

  const chosen = pick(text, locale);
  if (!chosen) return null;

  return {
    slug: row.slug,
    title: chosen.row.title,
    excerpt: chosen.row.excerpt,
    bodyMd: chosen.row.bodyMd,
    translated: chosen.translated,
    hasAffiliate: row.hasAffiliate,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt,
  };
}

/** Every published slug with its last edit, for the sitemap and the feeds. */
export async function getPublishedPostSlugs(): Promise<
  { slug: string; updatedAt: Date; publishedAt: Date | null }[]
> {
  return getDb()
    .select({
      slug: post.slug,
      updatedAt: post.updatedAt,
      publishedAt: post.publishedAt,
    })
    .from(post)
    .where(eq(post.status, "published"))
    .orderBy(desc(post.publishedAt));
}
