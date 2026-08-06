import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { listAdminTools } from "@/lib/queries/admin-tools";

export const dynamic = "force-dynamic";

/**
 * The tools list. BUILD_PLAN.md §3 and §12, Phase 4.
 *
 * Plain next/link rather than the locale-aware one: the panel sits outside the
 * [locale] segment and is English-only, so routing these through next-intl would
 * prefix every admin URL with a language it does not have.
 */
export default async function AdminToolsPage() {
  await requireAdmin();

  const tools = await listAdminTools();
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <div>
          <p className="text-caption text-ink-muted-80">
            <Link href="/admin" className="text-primary underline underline-offset-2">
              Admin
            </Link>
          </p>
          <h1 className="text-display-md font-display mt-xxs">Tools</h1>
        </div>

        <Link
          href="/admin/tools/new"
          className="bg-primary text-on-primary text-body rounded-pill px-button-primary-x py-button-primary-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
        >
          New tool
        </Link>
      </div>

      <p className="text-caption text-ink-muted-80 mt-md">
        A tool has no draft state, so saving one publishes it. What keeps a
        half-finished row off /tools is the English reason: without one it is not
        listed.
      </p>

      {tools.length === 0 ? (
        <p className="text-body text-ink-muted-80 mt-xxl">
          Nothing here yet. A tool is worth listing when you can say what it costs
          you, not just what it does.
        </p>
      ) : (
        <ul className="divide-hairline border-hairline mt-xl divide-y border-y">
          {tools.map((tool) => (
            <li key={tool.id} className="py-md">
              <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                <Link
                  href={`/admin/tools/${tool.id}`}
                  className="text-body-strong text-primary underline-offset-4 hover:underline"
                >
                  {tool.name}
                </Link>

                <span className="flex flex-wrap items-baseline gap-xs">
                  {tool.hasAffiliate ? <Badge tone="quiet">Affiliate</Badge> : null}
                  {!tool.personallyUsed ? <Badge tone="loud">Not used</Badge> : null}
                  {tool.hidden ? <Badge tone="loud">Not listed</Badge> : null}
                </span>
              </div>

              <p className="text-caption text-ink-muted-80 mt-xxs">
                {tool.whyIUseIt ?? (
                  <span className="italic">
                    No English reason — /tools will not show this one
                  </span>
                )}
              </p>

              <p className="text-caption text-ink-muted-80 mt-xxs flex flex-wrap items-baseline gap-x-md gap-y-xxs">
                {tool.vendor ? <span>{tool.vendor}</span> : null}
                {tool.categoryName ? <span>{tool.categoryName}</span> : null}
                <span className="tabular-nums">order {tool.sortOrder}</span>
                <time dateTime={tool.updatedAt.toISOString()} className="tabular-nums">
                  edited {dateFormat.format(tool.updatedAt)}
                </time>
              </p>

              {/* Visible without opening every record, for the reason §3 gives
                  about the repo caveats. "Not listed" already covers the missing
                  reason, so this only counts what is left. */}
              {tool.warnings > (tool.hidden ? 1 : 0) ? (
                <p className="text-caption text-primary mt-xxs">
                  {tool.warnings === 1
                    ? "1 thing left to write"
                    : `${tool.warnings} things left to write`}
                </p>
              ) : null}

              {tool.missingLocales.length > 0 ? (
                <p className="text-caption text-ink-muted-80 mt-xxs">
                  Not translated: {tool.missingLocales.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
