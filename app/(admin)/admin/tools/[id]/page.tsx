import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { getAdminTool } from "@/lib/queries/admin-tools";
import { listCategoryOptions } from "@/lib/queries/admin-categories";
import { ToolForm } from "../tool-form";
import { DeleteToolButton } from "../delete-button";

export const dynamic = "force-dynamic";

export default async function EditToolPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();

  const { id } = await props.params;
  const { saved } = await props.searchParams;

  const [entry, categories] = await Promise.all([
    getAdminTool(id),
    listCategoryOptions(),
  ]);

  if (!entry) notFound();

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin/tools" className="text-primary underline underline-offset-2">
          Tools
        </Link>
      </p>

      <div className="mt-xxs flex flex-wrap items-baseline justify-between gap-md">
        <h1 className="text-display-md font-display">{entry.name}</h1>

        <a
          href="/en/tools"
          target="_blank"
          rel="noopener noreferrer"
          className="text-caption text-primary underline underline-offset-2"
        >
          View the public page
        </a>
      </div>

      {saved ? (
        <p role="status" className="text-caption text-ink-muted-80 mt-sm">
          Saved.
        </p>
      ) : null}

      {/* §8: what the weekly HEAD checks know about this tool's URLs. Shown here
          rather than only in the dashboard, because this is the page where you
          would actually do something about it. */}
      {entry.links.some((l) => l.consecutiveFailures > 0) ? (
        <ul className="mt-lg">
          {entry.links
            .filter((l) => l.consecutiveFailures > 0)
            .map((link) => (
              <li key={link.url} className="text-caption text-primary">
                {link.consecutiveFailures} failed check
                {link.consecutiveFailures === 1 ? "" : "s"} on{" "}
                <span className="font-mono">{link.url}</span>
                {link.httpStatus ? ` — HTTP ${link.httpStatus}` : ""}
                {link.lastCheckedAt
                  ? `, last tried ${dateFormat.format(link.lastCheckedAt)}`
                  : ""}
              </li>
            ))}
        </ul>
      ) : null}

      <ToolForm
        toolId={entry.id}
        categories={categories}
        initial={{
          name: entry.name,
          vendor: entry.vendor,
          canonicalUrl: entry.canonicalUrl,
          affiliateUrl: entry.affiliateUrl,
          personallyUsed: entry.personallyUsed,
          categoryId: entry.categoryId,
          sortOrder: entry.sortOrder,
          translations: entry.translations,
        }}
      />

      <div className="border-hairline mt-xxl border-t pt-lg">
        <DeleteToolButton toolId={entry.id} label={entry.name} />
      </div>
    </div>
  );
}
