import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/require-admin";
import { getAdminPost } from "@/lib/queries/admin-posts";
import { PostForm } from "../post-form";
import { DeletePostButton } from "../delete-button";

export const dynamic = "force-dynamic";

export default async function EditPostPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();

  const { id } = await props.params;
  const { saved } = await props.searchParams;

  const post = await getAdminPost(id);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <p className="text-caption text-ink-muted-80">
        <Link href="/admin/writing" className="text-primary underline underline-offset-2">
          Writing
        </Link>
      </p>

      <div className="mt-xxs flex flex-wrap items-baseline justify-between gap-md">
        <h1 className="text-display-md font-display">
          {post.translations.en?.title ?? "Untitled"}
        </h1>

        {/* The public URL, not a preview. A published post is reachable, and
            this is the fastest way to check that it reads the way it was
            written — including whether the Markdown rendered as intended. */}
        {post.status === "published" ? (
          <a
            href={`/en/writing/${post.slug}`}
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

      <PostForm
        postId={post.id}
        initial={{
          slug: post.slug,
          status: post.status,
          hasAffiliate: post.hasAffiliate,
          translations: post.translations,
        }}
      />

      {post.status === "draft" ? (
        <div className="border-hairline mt-xxl border-t pt-lg">
          <DeletePostButton postId={post.id} slug={post.slug} />
        </div>
      ) : (
        <p className="text-caption text-ink-muted-80 border-hairline mt-xxl border-t pt-lg">
          Published posts cannot be deleted. Set it to draft first — the URL may
          already be linked from somewhere you do not control.
        </p>
      )}
    </div>
  );
}
