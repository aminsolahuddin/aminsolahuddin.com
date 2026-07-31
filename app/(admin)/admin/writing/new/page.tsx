import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { PostForm } from "../post-form";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin/writing" className="text-primary underline underline-offset-2">
          Writing
        </Link>
      </p>
      <h1 className="text-display-md font-display mt-xxs">New post</h1>

      <PostForm
        postId={null}
        initial={{
          slug: "",
          // Drafts by default. Publishing is a decision, and defaulting to it
          // makes the safe path the one you have to remember.
          status: "draft",
          hasAffiliate: false,
          translations: {},
        }}
      />
    </div>
  );
}
