import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { listAdminPacks } from "@/lib/queries/admin-packs";

export const dynamic = "force-dynamic";

/**
 * The pack list. BUILD_PLAN.md §6.
 *
 * Plain next/link rather than the locale-aware one from i18n/navigation: the
 * panel sits outside the [locale] segment and is English-only, so routing these
 * through next-intl would prefix every admin URL with a language it does not have.
 */
export default async function AdminPacksPage() {
  await requireAdmin();

  const packs = await listAdminPacks();

  const dateFormat = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  });

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <div>
          <p className="text-caption text-ink-muted-80">
            <Link href="/admin" className="text-primary underline underline-offset-2">
              Admin
            </Link>
          </p>
          <h1 className="text-display-md font-display mt-xxs">Resource packs</h1>
        </div>

        <Link
          href="/admin/resources/new"
          className="bg-primary text-on-primary text-body rounded-pill px-button-primary-x py-button-primary-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
        >
          New pack
        </Link>
      </div>

      {packs.length === 0 ? (
        <p className="text-body text-ink-muted-80 mt-xxl">
          No packs yet. The first one is also the first short link you can say in
          a video.
        </p>
      ) : (
        <ul className="divide-hairline border-hairline mt-xl divide-y border-y">
          {packs.map((pack) => (
            <li key={pack.id} className="py-md">
              <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                <Link
                  href={`/admin/resources/${pack.id}`}
                  className="text-body-strong text-primary underline-offset-4 hover:underline"
                >
                  {pack.title ?? (
                    <span className="text-ink-muted-80 italic">
                      Untitled — no English row
                    </span>
                  )}
                </Link>

                <StatusBadge status={pack.status} />
              </div>

              <p className="text-caption text-ink-muted-80 mt-xxs flex flex-wrap items-baseline gap-x-md gap-y-xxs">
                <code className="font-mono">/r/{pack.slug}</code>
                {pack.categoryName ? <span>{pack.categoryName}</span> : null}
                <span className="tabular-nums">
                  {pack.itemCount} {pack.itemCount === 1 ? "item" : "items"}
                </span>
                <time
                  dateTime={pack.updatedAt.toISOString()}
                  className="tabular-nums"
                >
                  edited {dateFormat.format(pack.updatedAt)}
                </time>
              </p>

              {/* §4 wants translation gaps visible without opening each record.
                  Listing what is missing beats a green tick that means nothing
                  until you know how many languages there were supposed to be. */}
              {pack.missingLocales.length > 0 ? (
                <p className="text-caption text-ink-muted-80 mt-xxs">
                  Not translated: {pack.missingLocales.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "draft" | "published" }) {
  const published = status === "published";

  return (
    <span
      className={`text-caption rounded-xs px-xs py-xxs ${
        published
          ? "bg-surface-pearl text-ink-muted-80"
          : "bg-ink text-on-dark"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}
