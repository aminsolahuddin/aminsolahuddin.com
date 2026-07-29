import type { RepoStatus } from "@/lib/queries/repo-entry";

/**
 * BUILD_PLAN.md §4 rule and CLAUDE.md rule 4: never delete a dead entry, mark it
 * and point at a replacement.
 *
 * The status is rendered as a word, never as a coloured dot alone. §15 does not
 * accept colour as the only carrier of meaning, and "archived" is exactly the
 * kind of thing a reader must not have to infer from a shade of amber.
 */
export function RepoStatusBadge({
  status,
  label,
}: {
  status: RepoStatus;
  label: string;
}) {
  const tone =
    status === "maintained"
      ? "bg-surface-pearl text-ink-muted-80"
      : "bg-ink text-on-dark";

  return (
    <span className={`text-caption rounded-xs px-xs py-xxs ${tone}`}>
      {label}
    </span>
  );
}

/**
 * A star count that has never been synced is null, not zero.
 *
 * Rendering it as 0 would be a lie in the one direction that matters — it makes
 * a popular project look abandoned, which is the opposite of what the sync job
 * exists to keep honest. §7 fills this in weekly; until then the page says so.
 */
export function StarCount({
  stars,
  starsLabel,
  notSyncedLabel,
}: {
  stars: number | null;
  starsLabel: string;
  notSyncedLabel: string;
}) {
  if (stars === null) {
    return <span className="text-caption text-ink-muted-80">{notSyncedLabel}</span>;
  }

  return (
    <span className="text-caption text-ink-muted-80 tabular-nums">
      {starsLabel}
    </span>
  );
}
