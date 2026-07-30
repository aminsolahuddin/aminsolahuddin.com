import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { listRepoCategoryOptions } from "@/lib/queries/admin-repos";
import { RepoForm } from "../repo-form";

export const dynamic = "force-dynamic";

export default async function NewRepoPage() {
  await requireAdmin();

  const categories = await listRepoCategoryOptions();

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin/repos" className="text-primary underline underline-offset-2">
          Repo library
        </Link>
      </p>
      <h1 className="text-display-md font-display mt-xxs">New entry</h1>

      <RepoForm
        entryId={null}
        categories={categories}
        initial={{
          owner: "",
          name: "",
          categoryId: null,
          // The sync job will correct this within the week. Starting anywhere
          // else would be guessing on behalf of the API.
          status: "maintained",
          supersededByUrl: null,
          // New entries start as drafts. Publishing is a decision, and
          // defaulting to it makes the safe path the one you have to remember.
          contentStatus: "draft",
          hasAffiliate: false,
          translations: {},
        }}
      />
    </div>
  );
}
