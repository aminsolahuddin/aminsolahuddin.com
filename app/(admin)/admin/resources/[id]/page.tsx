import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { getAdminPack, listAdminCategories } from "@/lib/queries/admin-packs";
import { PackForm } from "../pack-form";

export const dynamic = "force-dynamic";

export default async function EditPackPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();

  const { id } = await props.params;
  const { saved } = await props.searchParams;

  const [pack, categories] = await Promise.all([
    getAdminPack(id),
    listAdminCategories(),
  ]);

  if (!pack) notFound();

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link
          href="/admin/resources"
          className="text-primary underline underline-offset-2"
        >
          Resource packs
        </Link>
      </p>

      <div className="mt-xxs flex flex-wrap items-baseline justify-between gap-md">
        <h1 className="text-display-md font-display">
          {pack.translations.en?.title ?? "Untitled"}
        </h1>

        {/* The public URL, not a preview: a published pack is reachable and this
            is the fastest way to check that it reads the way it was written. */}
        {pack.status === "published" ? (
          <a
            href={`/r/${pack.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption text-primary underline underline-offset-2"
          >
            /r/{pack.slug}
          </a>
        ) : null}
      </div>

      {saved ? (
        <p role="status" className="text-caption text-ink-muted-80 mt-sm">
          Saved.
        </p>
      ) : null}

      <PackForm
        packId={pack.id}
        categories={categories}
        initial={{
          slug: pack.slug,
          categoryId: pack.categoryId,
          videoUrl: pack.videoUrl,
          repoUrl: pack.repoUrl,
          status: pack.status,
          hasAffiliate: pack.hasAffiliate,
          translations: pack.translations,
          items: pack.items.map((item) => ({
            id: item.id,
            kind: item.kind,
            url: item.url ?? "",
            body: item.body ?? "",
            lang: item.lang ?? "",
            isAffiliate: item.isAffiliate,
            translations: item.translations,
          })),
        }}
      />

    </div>
  );
}
