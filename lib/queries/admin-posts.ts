import "server-only";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { post, postI18n } from "@/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locales";

/**
 * Admin-side reads for posts. Separate from lib/queries/post.ts for the two
 * reasons every admin query module here is separate.
 *
 * Drafts are visible only through this file. Nothing falls back to English — an
 * empty Malay tab in the editor has to mean "no Malay row", because filling it
 * with the English text is how a translation gets marked done without anyone
 * writing it.
 */

export interface AdminPostRow {
  id: string;
  slug: string;
  status: "draft" | "published";
  title: string | null;
  hasAffiliate: boolean;
  missingLocales: Locale[];
  /** True when the English row has a title but no body worth publishing. */
  bodyEmpty: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
}

export async function listAdminPosts(): Promise<AdminPostRow[]> {
  const db = getDb();

  const posts = await db.select().from(post).orderBy(desc(post.updatedAt));
  if (posts.length === 0) return [];

  const text = await db
    .select()
    .from(postI18n)
    .where(
      inArray(
        postI18n.postId,
        posts.map((p) => p.id),
      ),
    );

  const byPost = new Map<string, typeof text>();
  for (const row of text) {
    const list = byPost.get(row.postId);
    if (list) list.push(row);
    else byPost.set(row.postId, [row]);
  }

  return posts.map((row) => {
    const rows = byPost.get(row.id) ?? [];
    const english = rows.find((r) => r.locale === DEFAULT_LOCALE);

    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      title: english?.title ?? null,
      hasAffiliate: row.hasAffiliate,
      missingLocales: LOCALES.filter((l) => !rows.some((r) => r.locale === l)),
      bodyEmpty: Boolean(english?.title) && !english?.bodyMd?.trim(),
      publishedAt: row.publishedAt,
      updatedAt: row.updatedAt,
    };
  });
}

export interface AdminPostDetail {
  id: string;
  slug: string;
  status: "draft" | "published";
  hasAffiliate: boolean;
  publishedAt: Date | null;
  translations: Partial<
    Record<Locale, { title: string; excerpt: string; bodyMd: string }>
  >;
}

export async function getAdminPost(id: string): Promise<AdminPostDetail | null> {
  const db = getDb();

  const [row] = await db.select().from(post).where(eq(post.id, id)).limit(1);
  if (!row) return null;

  const text = await db.select().from(postI18n).where(eq(postI18n.postId, id));

  const translations = {} as AdminPostDetail["translations"];
  for (const t of text) {
    translations[t.locale] = {
      title: t.title,
      excerpt: t.excerpt ?? "",
      bodyMd: t.bodyMd ?? "",
    };
  }

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    hasAffiliate: row.hasAffiliate,
    publishedAt: row.publishedAt,
    translations,
  };
}

/** True if the slug is taken by a different post. */
export async function postSlugTaken(
  slug: string,
  exceptId?: string,
): Promise<boolean> {
  // `and(...)`, never `&&`. Drizzle conditions are plain objects, so `a && b`
  // evaluates to b and drops the first condition without saying anything.
  const rows = await getDb()
    .select({ id: post.id })
    .from(post)
    .where(
      exceptId
        ? and(eq(post.slug, slug), ne(post.id, exceptId))
        : eq(post.slug, slug),
    )
    .limit(1);

  return rows.length > 0;
}
