/**
 * BUILD_PLAN.md §7: "Derive status: archived flag → archived; no commit in 12
 * months → slowing. Never auto-publish a status change to superseded — that
 * needs a human."
 *
 * Its own module with no imports so it can be tested directly. The rest of the
 * sync job is HTTP and SQL; this is the only part of it that is a decision.
 */

export type RepoStatus = "maintained" | "slowing" | "archived" | "superseded";

/** Twelve months with no commit is §7's threshold. */
export const SLOWING_AFTER_DAYS = 365;

/**
 * How much doubt each status expresses. Used to compare, not to store.
 *
 * The job may raise doubt on its own evidence but may not lower it without
 * evidence — see the note on fresh commits below. Ranking the four makes that
 * asymmetry something the code states rather than something four if-branches
 * happen to add up to.
 */
const DOUBT: Record<RepoStatus, number> = {
  maintained: 0,
  slowing: 1,
  archived: 2,
  superseded: 3,
};

const moreDoubtful = (a: RepoStatus, b: RepoStatus): RepoStatus =>
  DOUBT[a] >= DOUBT[b] ? a : b;

export function deriveStatus(
  current: RepoStatus,
  facts: { archived: boolean; pushedAt: Date | null },
  now: Date,
): RepoStatus {
  /**
   * The half of §7's rule that is easy to miss.
   *
   * "Never auto-publish a status change to superseded" is usually read as "do not
   * promote into it". The reverse matters just as much: an entry a human has
   * already marked superseded must not be derived back out of it. Something that
   * has been replaced has almost always also stopped getting commits, so the
   * twelve-month rule below would quietly demote a considered judgement to
   * "slowing" and throw away the only fact in the row a person supplied.
   */
  if (current === "superseded") return "superseded";

  if (facts.archived) return "archived";

  /**
   * No pushed_at at all — an empty repository. Neither direction has evidence, so
   * nothing moves. Reading a missing date as "stale" would mark a project dead on
   * the strength of no information.
   */
  if (!facts.pushedAt) return current;

  const days = (now.getTime() - facts.pushedAt.getTime()) / 86_400_000;

  /**
   * Fresh commits are the only thing that clears doubt, and this asymmetry is the
   * correction that running the job against real data forced.
   *
   * facebook/create-react-app is deprecated in its own README and has had no
   * commit since February 2025, but GitHub's `archived` flag is still false —
   * plenty of dead projects never get the flag flipped. The first version of this
   * function returned "maintained" whenever the flag was false, which downgraded a
   * human's considered "archived" to "slowing" on the first Sunday and would have
   * done it again every Sunday after he corrected it.
   *
   * So: the absence of an archived flag is not evidence of life. A commit this
   * month is. Only that positive evidence lowers the status; a stale clock can
   * raise it but never lowers it below what a person already decided.
   */
  if (days <= SLOWING_AFTER_DAYS) return "maintained";

  return moreDoubtful(current, "slowing");
}
