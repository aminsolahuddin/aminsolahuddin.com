import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

/**
 * Phase 0 ships the shell, not the CRUD. BUILD_PLAN.md §12 is explicit that a
 * phase is done when it is built, typechecked, deployed and usable — so the
 * dashboards below are listed as the Phase 1 and 2 work they are, rather than
 * faked with placeholder numbers that would look finished and be worthless.
 */
export default async function AdminDashboard() {
  const admin = await requireAdmin();

  const upcoming = [
    { phase: "Phase 1", item: "Media pipeline (R2 upload, WebP/AVIF, alt text)" },
    { phase: "Phase 2", item: "Repo entries, GitHub sync, link health" },
    { phase: "Phase 5", item: "Translation gaps for ms and zh-Hans" },
    { phase: "Phase 5", item: "Entries not reviewed in 6 months" },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <h1 className="text-display-md font-display">Admin</h1>
      <p className="text-body text-ink-muted-80 mt-xs">
        Signed in as {admin.githubLogin}.
      </p>

      <section className="mt-xl">
        <h2 className="text-tagline font-display">Content</h2>
        <ul className="mt-sm divide-y divide-hairline border-y border-hairline">
          <li className="py-sm">
            <Link
              href="/admin/resources"
              className="text-body text-primary underline-offset-4 hover:underline"
            >
              Resource packs
            </Link>
          </li>
          <li className="py-sm">
            <Link
              href="/admin/traffic"
              className="text-body text-primary underline-offset-4 hover:underline"
            >
              Short-link traffic
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-xl">
        <h2 className="text-tagline font-display">Not built yet</h2>
        <ul className="mt-sm divide-y divide-hairline border-y border-hairline">
          {upcoming.map((row) => (
            <li
              key={row.item}
              className="flex items-baseline justify-between gap-lg py-sm"
            >
              <span className="text-body">{row.item}</span>
              <span className="text-caption text-ink-muted-80 shrink-0">
                {row.phase}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
