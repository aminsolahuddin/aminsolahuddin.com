import "server-only";

import { desc, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { resourcePack, shortLinkHit, slugRedirect } from "@/db/schema";

/**
 * BUILD_PLAN.md §5: slug, hits, last 7 days, last 30 days.
 *
 * Attribution comes free here. One slug per video means the slug column already
 * answers "which video sent this", with no UTM tag to remember while recording
 * and nothing for a reader to paste around.
 */

export interface SlugTraffic {
  slug: string;
  total: number;
  last7: number;
  last30: number;
  /** Where the slug points now: itself, a renamed pack, or nothing. */
  resolvesTo: string | null;
  isRedirect: boolean;
}

export async function listSlugTraffic(): Promise<SlugTraffic[]> {
  const db = getDb();

  const rows = await db
    .select({
      slug: shortLinkHit.slug,
      total: sql<number>`count(*)::int`,
      // Counted in one pass rather than three queries. `filter` is the Postgres
      // spelling and reads closer to the question than a CASE sum.
      last7: sql<number>`count(*) filter (where ${shortLinkHit.createdAt} > now() - interval '7 days')::int`,
      last30: sql<number>`count(*) filter (where ${shortLinkHit.createdAt} > now() - interval '30 days')::int`,
    })
    .from(shortLinkHit)
    .groupBy(shortLinkHit.slug)
    .orderBy(desc(sql`count(*)`));

  if (rows.length === 0) return [];

  /**
   * A logged slug is not necessarily a current one. Renames leave the old slug
   * resolving forever, and traffic keeps arriving on it from videos that were
   * published before the rename — which is the whole point of rule 3, and worth
   * seeing rather than silently folding into the new name.
   */
  const [live, redirects] = await Promise.all([
    db.select({ slug: resourcePack.slug }).from(resourcePack),
    db
      .select({ oldSlug: slugRedirect.oldSlug, slug: resourcePack.slug })
      .from(slugRedirect)
      .innerJoin(resourcePack, sql`${resourcePack.id} = ${slugRedirect.packId}`),
  ]);

  const liveSlugs = new Set(live.map((r) => r.slug));
  const redirectMap = new Map(redirects.map((r) => [r.oldSlug, r.slug]));

  return rows.map((row) => {
    const redirectTarget = redirectMap.get(row.slug);

    return {
      slug: row.slug,
      total: Number(row.total),
      last7: Number(row.last7),
      last30: Number(row.last30),
      resolvesTo: liveSlugs.has(row.slug)
        ? row.slug
        : (redirectTarget ?? null),
      isRedirect: !liveSlugs.has(row.slug) && redirectTarget !== undefined,
    };
  });
}
