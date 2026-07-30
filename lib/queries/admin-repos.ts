import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  category,
  categoryI18n,
  linkHealth,
  repoEntry,
  repoEntryI18n,
  repoSyncChange,
} from "@/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locales";
import { caveatWarnings } from "@/lib/validation/repo";

/**
 * Admin-side reads for the repo library, separate from lib/queries/repo-entry.ts
 * for the same two reasons the pack queries are separate.
 *
 * Drafts are visible here and nowhere else — every public query filters on
 * `content_status = 'published'`, and one forgotten argument to a shared
 * function is all it would take to publish one.
 *
 * Nothing falls back to English. An empty Malay tab in the editor has to mean
 * "no Malay row", because quietly showing the English text there is how a
 * translation gets marked done without anybody writing it.
 */

export type RepoStatus = "maintained" | "slowing" | "archived" | "superseded";

export interface AdminRepoRow {
  id: string;
  owner: string;
  name: string;
  status: RepoStatus;
  contentStatus: "draft" | "published";
  oneLiner: string | null;
  categoryName: string | null;
  stars: number | null;
  syncedAt: Date | null;
  missingLocales: Locale[];
  /** How many of the §3 caveat fields the English row is still missing. */
  caveatGaps: number;
  /** Unacknowledged rows from the sync job. §7 */
  openChanges: number;
  updatedAt: Date;
}

export async function listAdminRepos(): Promise<AdminRepoRow[]> {
  const db = getDb();

  const entries = await db
    .select({
      id: repoEntry.id,
      owner: repoEntry.owner,
      name: repoEntry.name,
      status: repoEntry.status,
      contentStatus: repoEntry.contentStatus,
      stars: repoEntry.stars,
      syncedAt: repoEntry.syncedAt,
      categoryId: repoEntry.categoryId,
      updatedAt: repoEntry.updatedAt,
    })
    .from(repoEntry)
    .orderBy(desc(repoEntry.updatedAt));

  if (entries.length === 0) return [];

  const ids = entries.map((e) => e.id);

  const [text, categoryNames, changes] = await Promise.all([
    db.select().from(repoEntryI18n).where(inArray(repoEntryI18n.entryId, ids)),
    db
      .select({ categoryId: categoryI18n.categoryId, name: categoryI18n.name })
      .from(categoryI18n)
      .where(eq(categoryI18n.locale, DEFAULT_LOCALE)),
    db
      .select({ entryId: repoSyncChange.entryId, n: sql<number>`count(*)::int` })
      .from(repoSyncChange)
      .where(
        and(
          inArray(repoSyncChange.entryId, ids),
          isNull(repoSyncChange.acknowledgedAt),
        ),
      )
      .groupBy(repoSyncChange.entryId),
  ]);

  const byEntry = new Map<string, typeof text>();
  for (const row of text) {
    const list = byEntry.get(row.entryId);
    if (list) list.push(row);
    else byEntry.set(row.entryId, [row]);
  }

  const nameByCategory = new Map(categoryNames.map((c) => [c.categoryId, c.name]));
  const changesByEntry = new Map(changes.map((c) => [c.entryId, Number(c.n)]));

  return entries.map((entry) => {
    const rows = byEntry.get(entry.id) ?? [];
    const english = rows.find((r) => r.locale === DEFAULT_LOCALE);

    return {
      id: entry.id,
      owner: entry.owner,
      name: entry.name,
      status: entry.status,
      contentStatus: entry.contentStatus,
      oneLiner: english?.oneLiner ?? null,
      categoryName: entry.categoryId
        ? (nameByCategory.get(entry.categoryId) ?? null)
        : null,
      stars: entry.stars,
      syncedAt: entry.syncedAt,
      missingLocales: LOCALES.filter((l) => !rows.some((r) => r.locale === l)),
      /**
       * Surfaced in the list rather than only inside the editor. §3 calls these
       * fields the whole value of the section, and a gap you have to open every
       * record to find is a gap nobody finds.
       */
      caveatGaps: english
        ? caveatWarnings({
            oneLiner: english.oneLiner,
            forWhom: english.forWhom ?? "",
            notForYouIf: english.notForYouIf ?? "",
            theCatch: english.theCatch ?? "",
          }).length
        : 0,
      openChanges: changesByEntry.get(entry.id) ?? 0,
      updatedAt: entry.updatedAt,
    };
  });
}

export interface AdminRepoDetail {
  id: string;
  owner: string;
  name: string;
  githubUrl: string;
  categoryId: string | null;
  status: RepoStatus;
  supersededByUrl: string | null;
  contentStatus: "draft" | "published";
  hasAffiliate: boolean;
  stars: number | null;
  licenseSpdx: string | null;
  lastCommitAt: Date | null;
  syncedAt: Date | null;
  reviewedAt: Date | null;
  translations: Partial<
    Record<
      Locale,
      {
        oneLiner: string;
        forWhom: string;
        notForYouIf: string;
        replaces: string;
        theCatch: string;
      }
    >
  >;
  /** Every URL this entry publishes, with whatever the weekly job knows. §8 */
  links: {
    url: string;
    lastCheckedAt: Date | null;
    httpStatus: number | null;
    consecutiveFailures: number;
  }[];
}

export async function getAdminRepo(id: string): Promise<AdminRepoDetail | null> {
  const db = getDb();

  const [entry] = await db
    .select()
    .from(repoEntry)
    .where(eq(repoEntry.id, id))
    .limit(1);

  if (!entry) return null;

  const [text, links] = await Promise.all([
    db.select().from(repoEntryI18n).where(eq(repoEntryI18n.entryId, id)),
    db
      .select({
        url: linkHealth.url,
        lastCheckedAt: linkHealth.lastCheckedAt,
        httpStatus: linkHealth.httpStatus,
        consecutiveFailures: linkHealth.consecutiveFailures,
      })
      .from(linkHealth)
      .where(
        and(eq(linkHealth.targetType, "repo_entry"), eq(linkHealth.targetId, id)),
      )
      .orderBy(desc(linkHealth.consecutiveFailures)),
  ]);

  const translations = {} as AdminRepoDetail["translations"];
  for (const row of text) {
    translations[row.locale] = {
      oneLiner: row.oneLiner,
      forWhom: row.forWhom ?? "",
      notForYouIf: row.notForYouIf ?? "",
      replaces: row.replaces ?? "",
      theCatch: row.theCatch ?? "",
    };
  }

  return {
    id: entry.id,
    owner: entry.owner,
    name: entry.name,
    githubUrl: entry.githubUrl,
    categoryId: entry.categoryId,
    status: entry.status,
    supersededByUrl: entry.supersededByUrl,
    contentStatus: entry.contentStatus,
    hasAffiliate: entry.hasAffiliate,
    stars: entry.stars,
    licenseSpdx: entry.licenseSpdx,
    lastCommitAt: entry.lastCommitAt,
    syncedAt: entry.syncedAt,
    reviewedAt: entry.reviewedAt,
    translations,
    links,
  };
}

/**
 * True if some other entry is already this repo.
 *
 * Compared case-insensitively even though the case typed is what gets stored.
 * GitHub treats microsoft/TypeScript and microsoft/typescript as one repository
 * and so must this: the unique index is on the exact strings, so without this
 * check both spellings insert cleanly and the library grows two entries, two
 * URLs and two sets of sync results for the same project.
 */
export async function repoTaken(
  owner: string,
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const db = getDb();

  const sameRepo = and(
    sql`lower(${repoEntry.owner}) = lower(${owner})`,
    sql`lower(${repoEntry.name}) = lower(${name})`,
  );

  const rows = await db
    .select({ id: repoEntry.id })
    .from(repoEntry)
    // `and(...)`, never `&&`. Drizzle conditions are plain objects, so `a && b`
    // evaluates to b and drops the first condition without a word.
    .where(exceptId ? and(sameRepo, ne(repoEntry.id, exceptId)) : sameRepo)
    .limit(1);

  return rows.length > 0;
}

/** Categories for the editor's select. Machine key plus its English name. */
export async function listRepoCategoryOptions(): Promise<
  { id: string; key: string; name: string }[]
> {
  const rows = await getDb()
    .select({
      id: category.id,
      key: category.key,
      name: categoryI18n.name,
    })
    .from(category)
    .innerJoin(categoryI18n, eq(categoryI18n.categoryId, category.id))
    .where(eq(categoryI18n.locale, DEFAULT_LOCALE))
    .orderBy(asc(category.sortOrder));

  return rows;
}
