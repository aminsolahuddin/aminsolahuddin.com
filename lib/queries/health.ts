import "server-only";

import { and, asc, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import {
  linkHealth,
  repoEntry,
  repoSyncChange,
  resourceItem,
  resourceItemI18n,
  resourcePack,
  tool,
} from "@/db/schema";
import { DEFAULT_LOCALE } from "@/lib/locales";
import { SUSPECT_AFTER } from "@/lib/jobs/link-health";

/**
 * What the two weekly jobs want a human to look at. BUILD_PLAN.md §7 and §8.
 *
 * Deliberately cross-table: §8 checks every external URL the site publishes, and
 * the point of a dashboard is that one page answers "is anything rotting" without
 * knowing which table a URL happened to live in.
 */

export interface SyncChangeRow {
  id: string;
  kind: "status" | "license" | "missing";
  oldValue: string | null;
  newValue: string | null;
  detectedAt: Date;
  owner: string;
  name: string;
  entryId: string;
  contentStatus: "draft" | "published";
}

/** Everything the sync job has raised and nobody has read yet. §7 */
export async function listOpenSyncChanges(): Promise<SyncChangeRow[]> {
  return getDb()
    .select({
      id: repoSyncChange.id,
      kind: repoSyncChange.kind,
      oldValue: repoSyncChange.oldValue,
      newValue: repoSyncChange.newValue,
      detectedAt: repoSyncChange.detectedAt,
      owner: repoEntry.owner,
      name: repoEntry.name,
      entryId: repoEntry.id,
      contentStatus: repoEntry.contentStatus,
    })
    .from(repoSyncChange)
    .innerJoin(repoEntry, eq(repoSyncChange.entryId, repoEntry.id))
    .where(isNull(repoSyncChange.acknowledgedAt))
    /**
     * Published first, then oldest first. A change on a published entry is one a
     * reader can already see; a change on a draft can wait. Within each, the one
     * that has been sitting longest is the one being ignored.
     */
    .orderBy(desc(repoEntry.contentStatus), asc(repoSyncChange.detectedAt));
}

export interface SuspectLinkRow {
  url: string;
  targetType: string;
  consecutiveFailures: number;
  httpStatus: number | null;
  lastCheckedAt: Date | null;
  /** Where to go and fix it, when the target has an admin page. */
  adminHref: string | null;
  /** What the link is attached to, in words. */
  label: string;
}

/**
 * Links that have failed §8's three checks running.
 *
 * Resolved to a label and an admin link per target type. A dashboard row reading
 * only "https://… failed 4 times" costs a database query to act on, and the
 * whole reason this page exists is to make acting on it cheap.
 */
export async function listSuspectLinks(): Promise<SuspectLinkRow[]> {
  const db = getDb();

  const rows = await db
    .select({
      url: linkHealth.url,
      targetType: linkHealth.targetType,
      targetId: linkHealth.targetId,
      consecutiveFailures: linkHealth.consecutiveFailures,
      httpStatus: linkHealth.httpStatus,
      lastCheckedAt: linkHealth.lastCheckedAt,
    })
    .from(linkHealth)
    .where(gte(linkHealth.consecutiveFailures, SUSPECT_AFTER))
    .orderBy(desc(linkHealth.consecutiveFailures));

  if (rows.length === 0) return [];

  const byType = (type: string) =>
    rows.filter((r) => r.targetType === type).map((r) => r.targetId);

  const [repos, packs, items, tools] = await Promise.all([
    lookup(byType("repo_entry"), () =>
      db
        .select({
          id: repoEntry.id,
          label: sql<string>`${repoEntry.owner} || '/' || ${repoEntry.name}`,
          href: sql<string>`'/admin/repos/' || ${repoEntry.id}`,
        })
        .from(repoEntry),
    ),
    lookup(byType("resource_pack"), () =>
      db
        .select({
          id: resourcePack.id,
          label: sql<string>`'/r/' || ${resourcePack.slug}`,
          href: sql<string>`'/admin/resources/' || ${resourcePack.id}`,
        })
        .from(resourcePack),
    ),
    lookup(byType("resource_item"), () =>
      db
        .select({
          id: resourceItem.id,
          label: resourceItemI18n.label,
          href: sql<string>`'/admin/resources/' || ${resourceItem.packId}`,
        })
        .from(resourceItem)
        .leftJoin(
          resourceItemI18n,
          and(
            eq(resourceItemI18n.itemId, resourceItem.id),
            eq(resourceItemI18n.locale, DEFAULT_LOCALE),
          ),
        ),
    ),
    // Tools have no admin page until Phase 4. The row still appears, with the
    // name and no link, because a broken affiliate URL is worth knowing about
    // before there is a screen to fix it on.
    lookup(byType("tool"), () =>
      db.select({ id: tool.id, label: tool.name, href: sql<string>`null` }).from(tool),
    ),
  ]);

  const resolved = new Map([...repos, ...packs, ...items, ...tools]);

  return rows.map((row) => {
    const target = resolved.get(row.targetId);
    return {
      url: row.url,
      targetType: row.targetType,
      consecutiveFailures: row.consecutiveFailures,
      httpStatus: row.httpStatus,
      lastCheckedAt: row.lastCheckedAt,
      adminHref: target?.href ?? null,
      label: target?.label ?? "Unknown target",
    };
  });
}

/**
 * Run a lookup only when something needs it, and index the result by id.
 *
 * The queries above select every row of their table rather than filtering by the
 * ids in hand. That is on purpose: these tables hold tens of rows, not millions,
 * and the alternative is four `inArray` calls that each break on an empty array.
 */
async function lookup(
  ids: string[],
  query: () => Promise<{ id: string; label: string | null; href: string | null }[]>,
): Promise<[string, { label: string; href: string | null }][]> {
  if (ids.length === 0) return [];

  const wanted = new Set(ids);
  const rows = await query();

  return rows
    .filter((row) => wanted.has(row.id))
    .map((row) => [row.id, { label: row.label ?? "Untitled", href: row.href }]);
}

/** Entries no human has looked at in six months. §5 of the durability phase. */
export async function countStaleReviews(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 182 * 86_400_000);

  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(repoEntry)
    .where(
      and(
        eq(repoEntry.contentStatus, "published"),
        /**
         * Built from `or`/`lt` rather than a sql`` template holding the cutoff.
         *
         * A Date interpolated into a template is handed to the driver as a bare
         * parameter with no column type to encode it against, and postgres-js
         * refuses it at bind time — a runtime failure on first page load that
         * typecheck and build both pass clean. The operator helpers carry the
         * column's type with them, so the date is encoded properly.
         *
         * A null reviewed_at counts as stale: nobody has ever confirmed the
         * entry, which is the more urgent version of the same problem.
         */
        or(isNull(repoEntry.reviewedAt), lt(repoEntry.reviewedAt, cutoff)),
      ),
    );

  return Number(row?.n ?? 0);
}
