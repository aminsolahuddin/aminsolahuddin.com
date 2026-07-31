import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import {
  countStaleReviews,
  getSyncFreshness,
  listOpenSyncChanges,
  listSuspectLinks,
} from "@/lib/queries/health";
import { AcknowledgeButton } from "./acknowledge-button";

export const dynamic = "force-dynamic";

/**
 * BUILD_PLAN.md §7 and §8, and the acceptance line in §12: "an archived repo
 * surfaces in the dashboard rather than silently misleading readers."
 *
 * Nothing here is a number on its own. Every row names the thing, says what
 * happened, and links to the page where it can be fixed — a count with no route
 * to action is a count that gets read once and then ignored.
 */
export default async function HealthPage() {
  await requireAdmin();

  const [changes, links, stale, sync] = await Promise.all([
    listOpenSyncChanges(),
    listSuspectLinks(),
    countStaleReviews(),
    getSyncFreshness(),
  ]);

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin" className="text-primary underline underline-offset-2">
          Admin
        </Link>
      </p>
      <h1 className="text-display-md font-display mt-xxs">Rot</h1>
      <p className="text-body text-ink-muted-80 mt-xs text-pretty">
        What the weekly jobs found. Rule 4: nothing here gets deleted — it gets
        marked, and pointed somewhere.
      </p>

      {/* Above everything else on purpose. If the sync has stopped running, the
          three sections below are reporting on data that stopped moving, and
          "nothing new since you last looked" would be a lie told confidently. */}
      {sync.stale ? (
        <aside
          role="status"
          className="border-hairline bg-surface-pearl rounded-sm mt-xl border p-md"
        >
          <p className="text-body-strong">The sync has stopped running.</p>
          <p className="text-body text-ink-muted-80 mt-xxs text-pretty">
            {sync.lastSyncedAt
              ? `Last successful run was ${dateFormat.format(sync.lastSyncedAt)}. Everything below is reporting on data from then.`
              : "It has never completed a run. Star counts and statuses on the public pages have never been checked."}
          </p>
          <p className="text-caption text-ink-muted-80 mt-xs text-pretty">
            The usual cause is GITHUB_SYNC_TOKEN expiring — fine-grained tokens
            always do. Generate a new one, set it in Vercel, and redeploy. The
            failures themselves are in the Vercel cron log for{" "}
            <span className="font-mono">/api/cron/github-sync</span>.
          </p>
        </aside>
      ) : null}

      <section className="mt-xxl">
        <h2 className="text-tagline font-display">Changed on GitHub</h2>
        <p className="text-caption text-ink-muted-80 mt-xxs">
          The facts are already updated. What the page <em>says</em> about them is
          yours to decide.
          {/* Stated even when healthy. "Nothing new" only means something once
              you can see the job that would have found something is alive. */}
          {sync.lastSyncedAt && !sync.stale ? (
            <> Last checked {dateFormat.format(sync.lastSyncedAt)}.</>
          ) : null}
        </p>

        {changes.length === 0 ? (
          <p className="text-body text-ink-muted-80 mt-md">
            Nothing new since you last looked.
          </p>
        ) : (
          <ul className="divide-hairline border-hairline mt-md divide-y border-y">
            {changes.map((change) => (
              <li key={change.id} className="py-md">
                <div className="flex flex-wrap items-baseline justify-between gap-md">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/repos/${change.entryId}`}
                      className="text-body-strong font-mono text-primary underline-offset-4 hover:underline"
                    >
                      {change.owner}/{change.name}
                    </Link>
                    <p className="text-body mt-xxs text-pretty">
                      {describe(change)}
                    </p>
                    <p className="text-caption text-ink-muted-80 mt-xxs">
                      <time
                        dateTime={change.detectedAt.toISOString()}
                        className="tabular-nums"
                      >
                        found {dateFormat.format(change.detectedAt)}
                      </time>
                      {change.contentStatus === "published"
                        ? " · readers can see this"
                        : " · draft, nobody can see it yet"}
                    </p>
                  </div>

                  <AcknowledgeButton changeId={change.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-xxl">
        <h2 className="text-tagline font-display">Links that stopped answering</h2>
        <p className="text-caption text-ink-muted-80 mt-xxs">
          Three failed weekly checks in a row. One failure is a timeout; three is
          a dead link.
        </p>

        {links.length === 0 ? (
          <p className="text-body text-ink-muted-80 mt-md">
            Every external link answered.
          </p>
        ) : (
          <ul className="divide-hairline border-hairline mt-md divide-y border-y">
            {links.map((link) => (
              <li key={`${link.targetType}-${link.url}`} className="py-md">
                <p className="text-body-strong">
                  {link.adminHref ? (
                    <Link
                      href={link.adminHref}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    link.label
                  )}
                </p>
                <p className="text-caption text-ink-muted-80 mt-xxs break-all font-mono">
                  {link.url}
                </p>
                <p className="text-caption text-ink-muted-80 mt-xxs tabular-nums">
                  {link.consecutiveFailures} failed checks
                  {/* 0 is stored for a timeout or a DNS failure, which is not an
                      HTTP status and must not be printed as one. */}
                  {link.httpStatus ? ` · HTTP ${link.httpStatus}` : " · no response"}
                  {link.lastCheckedAt
                    ? ` · last tried ${dateFormat.format(link.lastCheckedAt)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-xxl">
        <h2 className="text-tagline font-display">Not looked at in six months</h2>
        <p className="text-caption text-ink-muted-80 mt-xxs">
          Rule 4: every entry carries when a human last checked it. A sync job is
          not a human.
        </p>
        <p className="text-body mt-md">
          {stale === 0 ? (
            <span className="text-ink-muted-80">
              Every published entry has been reviewed recently.
            </span>
          ) : (
            <Link
              href="/admin/repos"
              className="text-primary underline underline-offset-2"
            >
              {stale === 1
                ? "1 published entry"
                : `${stale} published entries`}{" "}
              need a look
            </Link>
          )}
        </p>
      </section>
    </div>
  );
}

/** The change in a sentence. A field name and two values is not a sentence. */
function describe(change: {
  kind: "status" | "license" | "missing";
  oldValue: string | null;
  newValue: string | null;
}): string {
  if (change.kind === "missing") {
    return "Gone from GitHub — deleted, renamed, or made private. Mark it superseded and say where to go instead, or unpublish it.";
  }

  if (change.kind === "license") {
    const from = change.oldValue ?? "no stated licence";
    const to = change.newValue ?? "no stated licence";
    return `Licence changed from ${from} to ${to}. Worth checking whether the recommendation still holds.`;
  }

  return `Status changed from ${STATUS_WORDS[change.oldValue ?? ""] ?? change.oldValue} to ${STATUS_WORDS[change.newValue ?? ""] ?? change.newValue}.`;
}

const STATUS_WORDS: Record<string, string> = {
  maintained: "maintained",
  slowing: "slowing down",
  archived: "archived",
  superseded: "superseded",
};
