import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { getAdminRepo } from "@/lib/queries/admin-repos";
import { listCategoryOptions } from "@/lib/queries/admin-categories";
import { RepoForm } from "../repo-form";
import { DeleteRepoButton } from "../delete-button";

export const dynamic = "force-dynamic";

export default async function EditRepoPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();

  const { id } = await props.params;
  const { saved } = await props.searchParams;

  const [entry, categories] = await Promise.all([
    getAdminRepo(id),
    listCategoryOptions(),
  ]);

  if (!entry) notFound();

  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
  const number = new Intl.NumberFormat("en");

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin/repos" className="text-primary underline underline-offset-2">
          Repo library
        </Link>
      </p>

      <div className="mt-xxs flex flex-wrap items-baseline justify-between gap-md">
        <h1 className="text-display-md font-display font-mono">
          {entry.owner}/{entry.name}
        </h1>

        {entry.contentStatus === "published" ? (
          <a
            href={`/en/repos/${entry.owner}/${entry.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-primary underline underline-offset-2"
          >
            View the public page
          </a>
        ) : null}
      </div>

      {saved ? (
        <p role="status" className="text-caption text-ink-muted-80 mt-sm">
          Saved.
        </p>
      ) : null}

      {/* Everything the sync job owns, read-only. §7 writes these and the form
          must not offer to edit them: a hand-typed star count is a number that
          is wrong by next Tuesday and looks authoritative until then. */}
      <dl className="border-hairline bg-canvas-parchment rounded-sm mt-lg grid gap-md border p-md tablet:grid-cols-4">
        <Fact label="Stars">
          {entry.stars === null ? "Not synced" : number.format(entry.stars)}
        </Fact>
        <Fact label="Licence">{entry.licenseSpdx ?? "Unknown"}</Fact>
        <Fact label="Last commit">
          {entry.lastCommitAt ? dateFormat.format(entry.lastCommitAt) : "Unknown"}
        </Fact>
        <Fact label="Synced">
          {entry.syncedAt ? dateFormat.format(entry.syncedAt) : "Never"}
        </Fact>
      </dl>

      {/* §8: what the weekly HEAD checks know about this entry's URLs. Shown
          here rather than only in the dashboard, because this is the page where
          you would actually do something about it. */}
      {entry.links.some((l) => l.consecutiveFailures > 0) ? (
        <ul className="mt-md">
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

      <RepoForm
        entryId={entry.id}
        categories={categories}
        initial={{
          owner: entry.owner,
          name: entry.name,
          categoryId: entry.categoryId,
          status: entry.status,
          supersededByUrl: entry.supersededByUrl,
          contentStatus: entry.contentStatus,
          hasAffiliate: entry.hasAffiliate,
          translations: entry.translations,
        }}
      />

      {/* Drafts only, and rule 4 is the reason. A published entry has a URL that
          has been linked; marking it superseded keeps it answering the question
          it was found by, and deleting it turns that question into a 404. */}
      {entry.contentStatus === "draft" ? (
        <div className="border-hairline mt-xxl border-t pt-lg">
          <DeleteRepoButton entryId={entry.id} label={`${entry.owner}/${entry.name}`} />
        </div>
      ) : (
        <p className="text-caption text-ink-muted-80 border-hairline mt-xxl border-t pt-lg">
          Published entries cannot be deleted. Set it to draft, or mark it
          superseded and say what replaced it — a dead entry that points somewhere
          is worth more than a 404.
        </p>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-ink-muted-80">{label}</dt>
      <dd className="text-body mt-xxs tabular-nums">{children}</dd>
    </div>
  );
}
