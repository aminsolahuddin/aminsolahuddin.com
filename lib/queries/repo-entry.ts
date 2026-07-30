import "server-only";

import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  category,
  categoryI18n,
  linkHealth,
  repoEntry,
  repoEntryI18n,
} from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/lib/locales";
/**
 * §8's threshold, imported rather than restated. The job that counts the failures
 * and the page that renders the marker have to agree, and two copies of a 3 in
 * two files is how they stop agreeing.
 */
import { SUSPECT_AFTER } from "@/lib/jobs/link-health";

/**
 * BUILD_PLAN.md §3: `one_liner`, `for_whom`, `not_for_you_if`, `replaces`,
 * `the_catch`. The last four are the whole point — a summary that restates the
 * README is not worth publishing, and "the catch" in particular cannot be
 * written in marketing voice without the sentence falling apart.
 *
 * Owner and name are never on the i18n table and so can never be translated.
 * That is structural, not a convention someone has to remember.
 */

export type RepoStatus = "maintained" | "slowing" | "archived" | "superseded";

export interface RepoSummary {
  owner: string;
  name: string;
  githubUrl: string;
  status: RepoStatus;
  supersededByUrl: string | null;
  stars: number | null;
  licenseSpdx: string | null;
  lastCommitAt: Date | null;
  syncedAt: Date | null;
  categoryKey: string | null;
  oneLiner: string;
  translated: boolean;
  /** Set when link health has failed three times running. §8 */
  linkSuspect: boolean;
}

export interface RepoDetail extends RepoSummary {
  forWhom: string | null;
  notForYouIf: string | null;
  replaces: string | null;
  theCatch: string | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
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
 * Every published entry, optionally narrowed to a category.
 *
 * There is no `search` option any more. Search happens in the browser over rows
 * that are already on the page — see components/live-filter.tsx — and leaving a
 * database-side search here that nothing calls would be a function nobody could
 * trust the day it was finally needed.
 */
export async function listRepos(
  locale: Locale,
  options: { categoryKey?: string } = {},
): Promise<RepoSummary[]> {
  const db = getDb();
  const locales = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];

  const rows = await db
    .select({
      id: repoEntry.id,
      owner: repoEntry.owner,
      name: repoEntry.name,
      githubUrl: repoEntry.githubUrl,
      status: repoEntry.status,
      supersededByUrl: repoEntry.supersededByUrl,
      stars: repoEntry.stars,
      licenseSpdx: repoEntry.licenseSpdx,
      lastCommitAt: repoEntry.lastCommitAt,
      syncedAt: repoEntry.syncedAt,
      categoryKey: category.key,
    })
    .from(repoEntry)
    .leftJoin(category, eq(repoEntry.categoryId, category.id))
    .where(eq(repoEntry.contentStatus, "published"))
    /**
     * Stars descending, but nulls last. A repo that has never been synced has
     * no star count, and Postgres sorts NULL highest by default — which would
     * float every unsynced entry to the top as though it were the most starred.
     */
    .orderBy(sql`${repoEntry.stars} desc nulls last`, asc(repoEntry.name));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);

  const [text, health] = await Promise.all([
    db
      .select()
      .from(repoEntryI18n)
      .where(
        and(
          inArray(repoEntryI18n.entryId, ids),
          inArray(repoEntryI18n.locale, locales),
        ),
      ),
    db
      .select({
        targetId: linkHealth.targetId,
        failures: linkHealth.consecutiveFailures,
      })
      .from(linkHealth)
      .where(
        and(
          eq(linkHealth.targetType, "repo_entry"),
          inArray(linkHealth.targetId, ids),
        ),
      ),
  ]);

  const byEntry = new Map<string, typeof text>();
  for (const row of text) {
    const list = byEntry.get(row.entryId);
    if (list) list.push(row);
    else byEntry.set(row.entryId, [row]);
  }

  const suspect = new Set(
    health.filter((h) => h.failures >= SUSPECT_AFTER).map((h) => h.targetId),
  );

  return rows.flatMap((row) => {
    const chosen = pick(byEntry.get(row.id) ?? [], locale);
    // No English row means no one-liner in any language a reader can be given.
    if (!chosen) return [];

    if (options.categoryKey && row.categoryKey !== options.categoryKey) return [];

    return [
      {
        owner: row.owner,
        name: row.name,
        githubUrl: row.githubUrl,
        status: row.status,
        supersededByUrl: row.supersededByUrl,
        stars: row.stars,
        licenseSpdx: row.licenseSpdx,
        lastCommitAt: row.lastCommitAt,
        syncedAt: row.syncedAt,
        categoryKey: row.categoryKey,
        oneLiner: chosen.row.oneLiner,
        translated: chosen.translated,
        linkSuspect: suspect.has(row.id),
      },
    ];
  });
}

export async function getRepo(
  owner: string,
  name: string,
  locale: Locale,
): Promise<RepoDetail | null> {
  const db = getDb();
  const locales = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];

  const [row] = await db
    .select({
      id: repoEntry.id,
      owner: repoEntry.owner,
      name: repoEntry.name,
      githubUrl: repoEntry.githubUrl,
      status: repoEntry.status,
      supersededByUrl: repoEntry.supersededByUrl,
      stars: repoEntry.stars,
      licenseSpdx: repoEntry.licenseSpdx,
      lastCommitAt: repoEntry.lastCommitAt,
      syncedAt: repoEntry.syncedAt,
      reviewedAt: repoEntry.reviewedAt,
      publishedAt: repoEntry.publishedAt,
      categoryKey: category.key,
    })
    .from(repoEntry)
    .leftJoin(category, eq(repoEntry.categoryId, category.id))
    .where(
      and(
        eq(repoEntry.owner, owner),
        eq(repoEntry.name, name),
        eq(repoEntry.contentStatus, "published"),
      ),
    )
    .limit(1);

  if (!row) return null;

  const [text, health] = await Promise.all([
    db
      .select()
      .from(repoEntryI18n)
      .where(
        and(
          eq(repoEntryI18n.entryId, row.id),
          inArray(repoEntryI18n.locale, locales),
        ),
      ),
    /**
     * Every health row for this entry, not the first one.
     *
     * An entry carries its GitHub URL and, when superseded, the URL of whatever
     * replaced it — two rows that fail independently. A limit(1) with no ordering
     * picks whichever the planner happens to return, so the marker would appear
     * or not depending on nothing.
     */
    db
      .select({ failures: linkHealth.consecutiveFailures })
      .from(linkHealth)
      .where(
        and(
          eq(linkHealth.targetType, "repo_entry"),
          eq(linkHealth.targetId, row.id),
        ),
      ),
  ]);

  const chosen = pick(text, locale);
  if (!chosen) return null;

  const worstLink = health.reduce((worst, h) => Math.max(worst, h.failures), 0);

  return {
    owner: row.owner,
    name: row.name,
    githubUrl: row.githubUrl,
    status: row.status,
    supersededByUrl: row.supersededByUrl,
    stars: row.stars,
    licenseSpdx: row.licenseSpdx,
    lastCommitAt: row.lastCommitAt,
    syncedAt: row.syncedAt,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    categoryKey: row.categoryKey,
    oneLiner: chosen.row.oneLiner,
    forWhom: chosen.row.forWhom,
    notForYouIf: chosen.row.notForYouIf,
    replaces: chosen.row.replaces,
    theCatch: chosen.row.theCatch,
    translated: chosen.translated,
    linkSuspect: worstLink >= SUSPECT_AFTER,
  };
}

/** Categories that have a published repo in them, with counts. */
export async function listRepoCategories(
  locale: Locale,
): Promise<{ key: string; name: string; count: number }[]> {
  const db = getDb();
  const locales = locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE];

  const used = await db
    .select({
      id: category.id,
      key: category.key,
      sortOrder: category.sortOrder,
      n: count(),
    })
    .from(repoEntry)
    .innerJoin(category, eq(repoEntry.categoryId, category.id))
    .where(eq(repoEntry.contentStatus, "published"))
    .groupBy(category.id, category.key, category.sortOrder)
    .orderBy(asc(category.sortOrder));

  if (used.length === 0) return [];

  const names = await db
    .select()
    .from(categoryI18n)
    .where(
      and(
        inArray(
          categoryI18n.categoryId,
          used.map((c) => c.id),
        ),
        inArray(categoryI18n.locale, locales),
      ),
    );

  const byCategory = new Map<string, typeof names>();
  for (const row of names) {
    const list = byCategory.get(row.categoryId);
    if (list) list.push(row);
    else byCategory.set(row.categoryId, [row]);
  }

  return used.flatMap((c) => {
    const name = pick(byCategory.get(c.id) ?? [], locale);
    if (!name) return [];
    return [{ key: c.key, name: name.row.name, count: Number(c.n) }];
  });
}

/** Every published owner/name pair, for the sitemap. */
export async function getPublishedRepoPaths(): Promise<
  { owner: string; name: string }[]
> {
  return getDb()
    .select({ owner: repoEntry.owner, name: repoEntry.name })
    .from(repoEntry)
    .where(eq(repoEntry.contentStatus, "published"))
    .orderBy(desc(repoEntry.publishedAt));
}
