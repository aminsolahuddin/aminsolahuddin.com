import "server-only";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { linkHealth, repoEntry, resourceItem, resourcePack, tool } from "@/db/schema";

/**
 * BUILD_PLAN.md §8: "Weekly job issues HEAD requests to every external URL across
 * all tables. Three consecutive failures marks the link and raises it in the
 * dashboard. The public page shows a small 'link may be broken' marker rather
 * than hiding it. Dead entries are never deleted."
 *
 * The consecutive count is the whole point. One failure is a timeout, a captive
 * portal, a deploy in progress; three weeks of failures is a dead link. A job
 * that marked on the first one would cry wolf until the marker meant nothing.
 */

/** §8. Fewer than this is noise, not a signal. */
export const SUSPECT_AFTER = 3;

type TargetType = "resource_pack" | "resource_item" | "repo_entry" | "post" | "tool";

interface Target {
  targetType: TargetType;
  targetId: string;
  url: string;
}

/**
 * Every external URL the site publishes.
 *
 * Internal paths are not here. A /r/ slug or a locale route is checked by the
 * build and by the tests; pointing a HEAD request at our own origin from a cron
 * job on that origin tests the network, not the link.
 */
export async function collectTargets(): Promise<Target[]> {
  const db = getDb();

  const [packs, items, repos, tools] = await Promise.all([
    db
      .select({ id: resourcePack.id, videoUrl: resourcePack.videoUrl, repoUrl: resourcePack.repoUrl })
      .from(resourcePack),
    db
      .select({ id: resourceItem.id, url: resourceItem.url })
      .from(resourceItem),
    db
      .select({
        id: repoEntry.id,
        githubUrl: repoEntry.githubUrl,
        supersededByUrl: repoEntry.supersededByUrl,
      })
      .from(repoEntry),
    db
      .select({
        id: tool.id,
        canonicalUrl: tool.canonicalUrl,
        affiliateUrl: tool.affiliateUrl,
      })
      .from(tool),
  ]);

  const targets: Target[] = [];
  const add = (targetType: TargetType, targetId: string, url: string | null) => {
    if (url && /^https?:\/\//i.test(url)) targets.push({ targetType, targetId, url });
  };

  for (const row of packs) {
    add("resource_pack", row.id, row.videoUrl);
    add("resource_pack", row.id, row.repoUrl);
  }
  for (const row of items) add("resource_item", row.id, row.url);
  for (const row of repos) {
    add("repo_entry", row.id, row.githubUrl);
    add("repo_entry", row.id, row.supersededByUrl);
  }
  for (const row of tools) {
    add("tool", row.id, row.canonicalUrl);
    /**
     * The affiliate URL is checked like any other. §11 is about disclosing that
     * a link pays; it says nothing about exempting it from being correct, and a
     * broken affiliate link is the one kind that costs the reader their trust and
     * Amin the referral at the same time.
     */
    add("tool", row.id, row.affiliateUrl);
  }

  // `post` is absent on purpose rather than by oversight: it has no external URL
  // column, its links live inside body_md, and extracting them belongs with the
  // Markdown renderer that Phase 3 brings.

  return targets;
}

export interface HealthReport {
  checked: number;
  ok: number;
  failed: number;
  /** Crossed SUSPECT_AFTER on this run — the ones worth a look. */
  newlySuspect: { url: string; failures: number }[];
}

/** How long to wait before calling a URL unreachable. */
const TIMEOUT_MS = 10_000;

/**
 * One request, HEAD first.
 *
 * Falls back to GET on 405 and 501, because a surprising number of servers —
 * including some CDNs — refuse HEAD outright. Treating that refusal as a dead
 * link would mark perfectly good URLs, so the fallback asks properly and then
 * abandons the body it did not want.
 */
async function probe(url: string): Promise<number> {
  const attempt = async (method: "HEAD" | "GET") => {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Some hosts return 403 to a client with no user agent, which would read
        // as a dead link when the URL is fine.
        "User-Agent": "aminsolahuddin.com-link-check",
      },
      cache: "no-store",
    });
    if (method === "GET") await response.body?.cancel();
    return response.status;
  };

  try {
    const status = await attempt("HEAD");
    if (status === 405 || status === 501) return attempt("GET");
    return status;
  } catch {
    // Timeout, DNS failure, refused connection, bad certificate. 0 is not an
    // HTTP status and is stored as one on purpose: it distinguishes "the server
    // said no" from "there was nothing there to say it".
    return 0;
  }
}

/**
 * Check every URL and record the result.
 *
 * Sequential with a pause between requests. A hundred simultaneous HEADs from one
 * IP is indistinguishable from a scan, and getting the origin IP rate-limited by
 * GitHub would make every entry in the library look broken at once — the exact
 * false alarm the three-strike rule exists to avoid.
 */
export async function checkLinks(
  now = new Date(),
  gapMs = 250,
): Promise<HealthReport> {
  const db = getDb();
  const targets = await collectTargets();

  const report: HealthReport = { checked: 0, ok: 0, failed: 0, newlySuspect: [] };

  for (const target of targets) {
    const status = await probe(target.url);

    /**
     * 2xx and 3xx pass. So does 429: being rate-limited proves the URL resolves
     * to something that answered, and counting it as a failure would mark the
     * healthiest, busiest links first.
     */
    const healthy = (status >= 200 && status < 400) || status === 429;

    report.checked += 1;
    if (healthy) report.ok += 1;
    else report.failed += 1;

    const [existing] = await db
      .select({
        id: linkHealth.id,
        consecutiveFailures: linkHealth.consecutiveFailures,
      })
      .from(linkHealth)
      .where(
        and(
          eq(linkHealth.targetType, target.targetType),
          eq(linkHealth.targetId, target.targetId),
          eq(linkHealth.url, target.url),
        ),
      )
      .limit(1);

    const before = existing?.consecutiveFailures ?? 0;
    // Reset to zero on success, never decremented. A link that works today is
    // working, and carrying two-thirds of a grudge forward from a bad month
    // would mark it on the next single blip.
    const failures = healthy ? 0 : before + 1;

    if (existing) {
      await db
        .update(linkHealth)
        .set({ lastCheckedAt: now, httpStatus: status, consecutiveFailures: failures })
        .where(eq(linkHealth.id, existing.id));
    } else {
      await db.insert(linkHealth).values({
        targetType: target.targetType,
        targetId: target.targetId,
        url: target.url,
        lastCheckedAt: now,
        httpStatus: status,
        consecutiveFailures: failures,
      });
    }

    // Reported on the run that crosses the line, not on every run after it. The
    // dashboard lists everything still failing; this is what changed.
    if (failures === SUSPECT_AFTER) {
      report.newlySuspect.push({ url: target.url, failures });
    }

    if (gapMs > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }

  return report;
}
