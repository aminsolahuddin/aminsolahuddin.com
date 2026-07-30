import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { repoEntry, repoSyncChange } from "@/db/schema";
import { deriveStatus } from "./derive-status";

/**
 * BUILD_PLAN.md §7. A weekly job that keeps the repo library from going stale
 * without anybody remembering to check.
 *
 * The division of labour is the whole design, and it comes straight out of §7:
 *
 *   Facts are written.   Stars, licence, last commit and the derived status go
 *                        into repo_entry. A reader looking at a "Maintained"
 *                        badge on a project that stopped eighteen months ago is
 *                        the misleading outcome §12 names, so leaving the badge
 *                        stale in order to avoid "silently rewriting" would
 *                        cause the exact harm the rule exists to prevent.
 *
 *   Prose is never touched.  Nothing here writes repo_entry_i18n. The
 *                        recommendation is the prose, and no job gets to edit
 *                        what a person said about a tool.
 *
 *   Judgements are flagged.  Status and licence changes land in repo_sync_change
 *                        for a human: "if a repo he recommended is now archived,
 *                        he should decide what to say about it."
 */

/**
 * Only what §7 asks for. The GitHub response carries eighty more fields, and
 * parsing them all would mean this breaks whenever any one of them changes shape.
 */
const repoResponse = z.object({
  archived: z.boolean(),
  stargazers_count: z.number().int(),
  pushed_at: z.string().nullable(),
  license: z.object({ spdx_id: z.string().nullable() }).nullable(),
});

export type SyncOutcome =
  | { entry: string; result: "updated"; flagged: number }
  | { entry: string; result: "missing" }
  | { entry: string; result: "failed"; status: number };

export interface SyncReport {
  checked: number;
  updated: number;
  missing: number;
  failed: number;
  flagged: number;
  /** Set when GitHub cut us off partway. The run stops rather than hammering it. */
  rateLimited: boolean;
  outcomes: SyncOutcome[];
}

async function fetchRepo(owner: string, name: string, token: string) {
  return fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "aminsolahuddin.com-sync",
      },
      // A weekly job has no use for a cached answer, and Next would happily
      // serve one from the previous run.
      cache: "no-store",
    },
  );
}

/**
 * Walk every entry, published or draft, and bring the facts up to date.
 *
 * Drafts are included on purpose: the star count and licence are what you look at
 * while deciding whether an entry is worth finishing, and a draft that only syncs
 * after publication has the numbers wrong at exactly the moment they matter.
 *
 * Sequential, not Promise.all. Fifty requests fired at once is what makes a
 * fine-grained PAT start returning 403s, and nothing about a job that runs on
 * Sundays needs to be fast.
 */
export async function syncRepos(token: string, now = new Date()): Promise<SyncReport> {
  const db = getDb();

  const entries = await db
    .select({
      id: repoEntry.id,
      owner: repoEntry.owner,
      name: repoEntry.name,
      status: repoEntry.status,
      contentStatus: repoEntry.contentStatus,
      licenseSpdx: repoEntry.licenseSpdx,
    })
    .from(repoEntry);

  const report: SyncReport = {
    checked: 0,
    updated: 0,
    missing: 0,
    failed: 0,
    flagged: 0,
    rateLimited: false,
    outcomes: [],
  };

  for (const entry of entries) {
    const label = `${entry.owner}/${entry.name}`;
    report.checked += 1;

    const response = await fetchRepo(entry.owner, entry.name, token);

    /**
     * 403 and 429 both mean the token is out of budget. Carrying on would spend
     * the rest of the run against a wall and produce a report full of failures
     * that say nothing about the repos. Stopping leaves the remaining entries on
     * last week's data, which is honest and fixes itself next Sunday.
     */
    if (response.status === 403 || response.status === 429) {
      report.rateLimited = true;
      break;
    }

    /**
     * 404 is not a failure, it is news: the repo has been deleted, renamed or
     * taken private. §8's principle applies — mark it, never quietly drop it.
     *
     * Flagged only while the entry is published, because that is the only state
     * in which anybody is being misled, and because it gives the flag somewhere
     * to stop. A weekly job on a permanently dead URL with no exit condition
     * would file the same row every Sunday for as long as the site exists.
     */
    if (response.status === 404) {
      report.missing += 1;
      report.outcomes.push({ entry: label, result: "missing" });
      if (
        entry.contentStatus === "published" &&
        (await flag(entry.id, "missing", label, null, now))
      ) {
        report.flagged += 1;
      }
      continue;
    }

    if (!response.ok) {
      report.failed += 1;
      report.outcomes.push({ entry: label, result: "failed", status: response.status });
      continue;
    }

    const parsed = repoResponse.safeParse(await response.json());
    if (!parsed.success) {
      // CLAUDE.md rule 7 reaches this far out too. A shape we do not recognise is
      // not something to write half of into the database.
      report.failed += 1;
      report.outcomes.push({ entry: label, result: "failed", status: 0 });
      continue;
    }

    const facts = parsed.data;
    const pushedAt = facts.pushed_at ? new Date(facts.pushed_at) : null;

    /**
     * GitHub sends "NOASSERTION" for a licence file it could not identify. It is
     * not an SPDX identifier, and rendering it as one would put a word on the
     * public page that means nothing to a reader. Unknown is the truthful version.
     */
    const spdx =
      facts.license?.spdx_id && facts.license.spdx_id !== "NOASSERTION"
        ? facts.license.spdx_id
        : null;

    const status = deriveStatus(
      entry.status,
      { archived: facts.archived, pushedAt },
      now,
    );

    await db
      .update(repoEntry)
      .set({
        stars: facts.stargazers_count,
        licenseSpdx: spdx,
        lastCommitAt: pushedAt,
        status,
        syncedAt: now,
        /**
         * updatedAt is deliberately left alone. It means "a human edited this",
         * and a weekly job bumping it would push every entry to the top of the
         * admin list every Sunday, burying whatever was actually being worked on.
         * reviewedAt is left alone for the same reason, more strongly: rule 4
         * wants it to mean a person looked, and a job is not a person.
         */
      })
      .where(eq(repoEntry.id, entry.id));

    let flagged = 0;

    /**
     * Only the two that can invalidate a recommendation.
     *
     * Stars move every week; flagging them would bury these under noise, and a
     * dashboard that is always full is one that stops being read. A status change
     * means the project stopped or restarted. A licence change means MIT quietly
     * became BUSL — which can make a recommendation actively harmful to follow.
     */
    if (status !== entry.status) {
      if (
        await flag(entry.id, "status", label, { from: entry.status, to: status }, now)
      ) {
        flagged += 1;
      }
    }

    if (spdx !== entry.licenseSpdx) {
      if (
        await flag(entry.id, "license", label, { from: entry.licenseSpdx, to: spdx }, now)
      ) {
        flagged += 1;
      }
    }

    report.flagged += flagged;
    report.updated += 1;
    report.outcomes.push({ entry: label, result: "updated", flagged });
  }

  return report;
}

/**
 * Record a change for a human, unless the same one is already waiting.
 *
 * Matched on kind and new value among *unacknowledged* rows only. Checking every
 * row instead would mean a repo that goes archived, comes back, and is archived
 * again the following year never files the second one — the history would suppress
 * the news. Acknowledged rows are kept as a record and stop suppressing anything.
 *
 * Returns whether it wrote one.
 */
async function flag(
  entryId: string,
  kind: "status" | "license" | "missing",
  label: string,
  change: { from: string | null; to: string | null } | null,
  now: Date,
): Promise<boolean> {
  const db = getDb();
  const newValue = change ? change.to : label;

  const open = await db
    .select({ newValue: repoSyncChange.newValue })
    .from(repoSyncChange)
    .where(
      and(
        eq(repoSyncChange.entryId, entryId),
        eq(repoSyncChange.kind, kind),
        isNull(repoSyncChange.acknowledgedAt),
      ),
    );

  if (open.some((row) => row.newValue === newValue)) return false;

  await db.insert(repoSyncChange).values({
    entryId,
    kind,
    oldValue: change?.from ?? null,
    newValue,
    detectedAt: now,
  });

  return true;
}
