"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { post, postI18n } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { postSlugTaken } from "@/lib/queries/admin-posts";
import { LOCALES, type Locale } from "@/lib/locales";
import { flattenIssues, type FormState } from "@/lib/form-state";
import { postSchema } from "@/lib/validation/post";

/**
 * BUILD_PLAN.md §3 and §12, Phase 3. CLAUDE.md rule 7.
 *
 * requireAdmin() runs first in every action: a server action is a public HTTP
 * endpoint, and the page that rendered the form having checked the session says
 * nothing about who is posting to it a week later.
 */

function readForm(data: FormData) {
  const str = (key: string) => {
    const value = data.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  const translations = LOCALES.flatMap((locale) => {
    const title = str(`title.${locale}`);
    const excerpt = str(`excerpt.${locale}`);
    const bodyMd = str(`body.${locale}`);

    // An untouched language is an absent row, not an empty one. Blank rows would
    // make §4's translation-gap dashboard report every post as fully translated
    // into languages nobody has written a word of.
    if (!title && !excerpt && !bodyMd) return [];

    return [{ locale, title, excerpt, bodyMd }];
  });

  return {
    slug: str("slug"),
    status: str("status") === "published" ? "published" : "draft",
    hasAffiliate: data.get("hasAffiliate") === "on",
    translations,
  };
}

/**
 * Every text field by its form name, so a rejected save redisplays what was
 * typed. Checkboxes are excluded — they are re-derived from the state the form
 * already renders, and a stale one would silently re-tick something.
 */
function echo(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string" && key !== "hasAffiliate") values[key] = value;
  }
  return values;
}

export async function savePost(
  postId: string | null,
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = postSchema.safeParse(readForm(data));

  if (!parsed.success) {
    return {
      ok: false,
      errors: flattenIssues(parsed.error.issues),
      warnings: [],
      values: echo(data),
    };
  }

  const input = parsed.data;

  if (await postSlugTaken(input.slug, postId ?? undefined)) {
    return {
      ok: false,
      errors: { slug: "Another post already uses this slug." },
      warnings: [],
      values: echo(data),
    };
  }

  const db = getDb();
  const now = new Date();

  const values = {
    slug: input.slug,
    status: input.status,
    hasAffiliate: input.hasAffiliate,
    // Rule 4: saving is a human looking at it, which is what reviewed_at records.
    reviewedAt: now,
    updatedAt: now,
  };

  let id = postId;

  if (id) {
    const [existing] = await db
      .select({ publishedAt: post.publishedAt })
      .from(post)
      .where(eq(post.id, id))
      .limit(1);

    if (!existing) {
      return {
        ok: false,
        errors: { form: "That post is gone." },
        warnings: [],
        values: echo(data),
      };
    }

    await db
      .update(post)
      .set({
        ...values,
        // First publication, not the latest edit. Rewriting it on every save
        // would turn "published in March" into "last touched on Tuesday", and
        // the public index sorts by exactly this column.
        publishedAt:
          input.status === "published" ? (existing.publishedAt ?? now) : null,
      })
      .where(eq(post.id, id));
  } else {
    const [created] = await db
      .insert(post)
      .values({
        ...values,
        publishedAt: input.status === "published" ? now : null,
      })
      .returning({ id: post.id });

    if (!created) {
      return {
        ok: false,
        errors: { form: "Could not create the post." },
        warnings: [],
        values: echo(data),
      };
    }
    id = created.id;
  }

  // Replaced wholesale: a language cleared in the form has to disappear rather
  // than linger as a stale row the gap dashboard counts as done.
  await db.delete(postI18n).where(eq(postI18n.postId, id));

  if (input.translations.length > 0) {
    await db.insert(postI18n).values(
      input.translations.map((t) => ({
        postId: id,
        locale: t.locale as Locale,
        title: t.title,
        excerpt: t.excerpt || null,
        bodyMd: t.bodyMd || null,
      })),
    );
  }

  revalidatePath("/admin/writing");
  redirect(`/admin/writing/${id}?saved=1`);
}

export async function deletePost(postId: string): Promise<void> {
  await requireAdmin();

  /**
   * Drafts only. A published post URL has been linked from elsewhere, and
   * deleting it turns someone else's link into a 404 — rule 3's reasoning, which
   * covers anything that has been public. Unpublish instead: the row stays and
   * the URL can be brought back.
   */
  const deleted = await getDb()
    .delete(post)
    .where(and(eq(post.id, postId), eq(post.status, "draft")))
    .returning({ id: post.id });

  if (deleted.length === 0) {
    throw new Error(
      "Only drafts can be deleted. Unpublish first — a published URL may already be linked from somewhere you do not control.",
    );
  }

  revalidatePath("/admin/writing");
  redirect("/admin/writing");
}
