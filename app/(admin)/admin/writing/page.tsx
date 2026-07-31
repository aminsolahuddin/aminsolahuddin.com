import Link from "next/link";

import { requireAdmin } from "@/lib/require-admin";
import { listAdminPosts } from "@/lib/queries/admin-posts";

export const dynamic = "force-dynamic";

export default async function AdminPostsPage() {
  await requireAdmin();

  const posts = await listAdminPosts();
  const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

  return (
    <div className="mx-auto max-w-4xl px-lg py-xxl">
      <div className="flex flex-wrap items-baseline justify-between gap-md">
        <div>
          <p className="text-caption text-ink-muted-80">
            <Link href="/admin" className="text-primary underline underline-offset-2">
              Admin
            </Link>
          </p>
          <h1 className="text-display-md font-display mt-xxs">Writing</h1>
        </div>

        <Link
          href="/admin/writing/new"
          className="bg-primary text-on-primary text-body rounded-pill px-button-primary-x py-button-primary-y transition-transform duration-150 active:scale-95 motion-reduce:active:scale-100"
        >
          New post
        </Link>
      </div>

      {posts.length === 0 ? (
        <p className="text-body text-ink-muted-80 mt-xxl">
          Nothing written yet.
        </p>
      ) : (
        <ul className="divide-hairline border-hairline mt-xl divide-y border-y">
          {posts.map((post) => (
            <li key={post.id} className="py-md">
              <div className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-xxs">
                <Link
                  href={`/admin/writing/${post.id}`}
                  className="text-body-strong text-primary underline-offset-4 hover:underline"
                >
                  {post.title ?? (
                    <span className="text-ink-muted-80 italic">
                      Untitled — no English row
                    </span>
                  )}
                </Link>

                <span
                  className={`text-caption rounded-xs px-xs py-xxs ${
                    post.status === "published"
                      ? "bg-surface-pearl text-ink-muted-80"
                      : "bg-ink text-on-dark"
                  }`}
                >
                  {post.status === "published" ? "Published" : "Draft"}
                </span>
              </div>

              <p className="text-caption text-ink-muted-80 mt-xxs flex flex-wrap items-baseline gap-x-md gap-y-xxs">
                <code className="font-mono">/writing/{post.slug}</code>
                {post.hasAffiliate ? <span>affiliate</span> : null}
                <time dateTime={post.updatedAt.toISOString()} className="tabular-nums">
                  edited {dateFormat.format(post.updatedAt)}
                </time>
              </p>

              {/* A title with nothing under it is a link that goes nowhere. The
                  schema refuses to publish one; this catches the draft before it
                  gets that far. */}
              {post.bodyEmpty ? (
                <p className="text-caption text-primary mt-xxs">
                  No body written yet
                </p>
              ) : null}

              {post.missingLocales.length > 0 ? (
                <p className="text-caption text-ink-muted-80 mt-xxs">
                  Not translated: {post.missingLocales.join(", ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
