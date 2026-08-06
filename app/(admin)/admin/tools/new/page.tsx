import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { listCategoryOptions } from "@/lib/queries/admin-categories";
import { nextToolSortOrder } from "@/lib/queries/admin-tools";
import { ToolForm } from "../tool-form";

export const dynamic = "force-dynamic";

export default async function NewToolPage() {
  await requireAdmin();

  const [categories, sortOrder] = await Promise.all([
    listCategoryOptions(),
    nextToolSortOrder(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin/tools" className="text-primary underline underline-offset-2">
          Tools
        </Link>
      </p>
      <h1 className="text-display-md font-display mt-xxs">New tool</h1>

      <ToolForm
        toolId={null}
        categories={categories}
        initial={{
          name: "",
          vendor: null,
          canonicalUrl: "",
          affiliateUrl: null,
          /**
           * Ticked, because the ordinary case is a tool that has been run — and
           * because §3's marker is a claim about the exception. Untick it and
           * the page says so.
           */
          personallyUsed: true,
          categoryId: null,
          // At the end of the list rather than the top of it. A new tool has not
          // earned the first row by being the most recently typed.
          sortOrder,
          translations: {},
        }}
      />
    </div>
  );
}
