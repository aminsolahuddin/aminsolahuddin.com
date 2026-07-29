import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { listAdminCategories } from "@/lib/queries/admin-packs";
import { PackForm } from "../pack-form";

export const dynamic = "force-dynamic";

export default async function NewPackPage() {
  await requireAdmin();

  const categories = await listAdminCategories();

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
      <h1 className="text-display-md font-display mt-xxs">New pack</h1>

      <PackForm
        packId={null}
        categories={categories}
        initial={{
          slug: "",
          categoryId: null,
          videoUrl: null,
          repoUrl: null,
          // New packs start as drafts. Publishing is a decision, and defaulting
          // to it would make the safe path the one that needs remembering.
          status: "draft",
          hasAffiliate: false,
          translations: {},
        }}
      />
    </div>
  );
}
