import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { listAdminRepos } from "@/lib/queries/admin-repos";

export const dynamic = "force-dynamic";

/**
 * The repo library list. BUILD_PLAN.md §3 and §12.
 *
 * Plain next/link rather than the locale-aware one: the panel sits outside the
 * [locale] segment and is English-only, so routing these through next-intl would
 * prefix every admin URL with a language it does not have.
 */
export default async function AdminReposPage() {
  await requireAdmin();

  const repos = await listAdminRepos();
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const number = new Intl.NumberFormat("en");

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <div>
          <p className="text-caption text-ink-muted-80">
            <Link href="/admin" className="text-primary underline underline-offset-2">
              Admin
            </Link>
          </p>
          <h1 className="text-display-md font-display mt-xxs">Repo library</h1>
        </div>

        <Link
          href="/admin/repos/new"
          className="bg-primary text-on-primary text-body rounded-pill px-button-primary-x py-button-primary-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
        >
          New entry
        </Link>
      </div>

      {repos.length === 0 ? (
        <p className="text-body text-ink-muted-80 mt-xxl">
          Nothing here yet. An entry is worth writing when you can say what the
          catch is.
        </p>
      ) : (
        <ul className="divide-hairline border-hairline mt-xl divide-y border-y">
          {repos.map((repo) => (
            <li key={repo.id} className="py-md">
              <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                <Link
                  href={`/admin/repos/${repo.id}`}
                  className="text-body-strong font-mono text-primary underline-offset-4 hover:underline"
                >
                  {repo.owner}/{repo.name}
                </Link>

                <span className="flex flex-wrap items-baseline gap-xs">
                  {repo.status !== "maintained" ? (
                    <Badge tone="loud">{STATUS_LABEL[repo.status]}</Badge>
                  ) : null}
                  <Badge tone={repo.contentStatus === "published" ? "quiet" : "loud"}>
                    {repo.contentStatus === "published" ? "Published" : "Draft"}
                  </Badge>
                </span>
              </div>

              <p className="text-caption text-ink-muted-80 mt-xxs">
                {repo.oneLiner ?? (
                  <span className="italic">No English row — nothing to render</span>
                )}
              </p>

              <p className="text-caption text-ink-muted-80 mt-xxs flex flex-wrap items-baseline gap-x-md gap-y-xxs">
                {repo.categoryName ? <span>{repo.categoryName}</span> : null}
                {/* Never 0 for an unsynced entry: §7 fills this in weekly, and a
                    zero would make a popular project look abandoned. */}
                <span className="tabular-nums">
                  {repo.stars === null
                    ? "not synced"
                    : `${number.format(repo.stars)} stars`}
                </span>
                <time dateTime={repo.updatedAt.toISOString()} className="tabular-nums">
                  edited {dateFormat.format(repo.updatedAt)}
                </time>
              </p>

              {/* §3 wants the caveat gaps visible without opening each record.
                  Published and thin is the case that matters — a draft is
                  allowed to be unfinished, that is what a draft is. */}
              {repo.caveatGaps > 0 && repo.contentStatus === "published" ? (
                <p className="text-caption text-primary mt-xxs">
                  {repo.caveatGaps === 1
                    ? "1 caveat field is empty"
                    : `${repo.caveatGaps} caveat fields are empty`}
                </p>
              ) : null}

              {repo.openChanges > 0 ? (
                <p className="text-caption mt-xxs">
                  <Link
                    href="/admin/health"
                    className="text-primary underline underline-offset-2"
                  >
                    {repo.openChanges === 1
                      ? "1 unread change from GitHub"
                      : `${repo.openChanges} unread changes from GitHub`}
                  </Link>
                </p>
              ) : null}

              {repo.missingLocales.length > 0 ? (
                <p className="text-caption text-ink-muted-80 mt-xxs">
                  Not translated: {repo.missingLocales.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_LABEL = {
  maintained: "Maintained",
  slowing: "Slowing down",
  archived: "Archived",
  superseded: "Superseded",
} as const;

function Badge({
  tone,
  children,
}: {
  tone: "quiet" | "loud";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`text-caption rounded-xs px-xs py-xxs ${
        tone === "quiet" ? "bg-surface-pearl text-ink-muted-80" : "bg-ink text-on-dark"
      }`}
    >
      {children}
    </span>
  );
}
