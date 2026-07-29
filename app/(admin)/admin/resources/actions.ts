"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { resourcePack, resourcePackI18n, slugRedirect } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { slugTaken } from "@/lib/queries/admin-packs";
import { LOCALES, type Locale } from "@/lib/locales";
import { packSchema, slugWarnings } from "@/lib/validation/pack";
import { parseVideoUrl } from "@/lib/video-url";

/**
 * CLAUDE.md rule 7: validate at the edge. requireAdmin() runs first in every
 * action here — a server action is a public HTTP endpoint, and the page that
 * renders the form having checked the session says nothing about who is posting
 * to it afterwards.
 */

export interface FormState {
  ok: boolean;
  /** Keyed by field name so the form can put each message beside its input. */
  errors: Record<string, string>;
  /** Slug warnings, shown with the override checkbox rather than as errors. §5 */
  warnings: string[];
}

export const EMPTY_STATE: FormState = { ok: false, errors: {}, warnings: [] };

function readForm(data: FormData) {
  const str = (key: string) => {
    const value = data.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  const translations = LOCALES.flatMap((locale) => {
    const title = str(`title.${locale}`);
    const summary = str(`summary.${locale}`);
    const notesMd = str(`notes.${locale}`);

    // A language with nothing in it is an absent row, not an empty one. Writing
    // blank strings would make the translation-gap dashboard report every pack
    // as fully translated into languages nobody has touched.
    if (!title && !summary && !notesMd) return [];

    return [{ locale, title, summary, notesMd }];
  });

  return {
    slug: str("slug"),
    slugOverride: data.get("slugOverride") === "on",
    categoryId: str("categoryId") || null,
    videoUrl: str("videoUrl") || null,
    repoUrl: str("repoUrl") || null,
    status: str("status") === "published" ? "published" : "draft",
    hasAffiliate: data.get("hasAffiliate") === "on",
    translations,
  };
}

function flatten(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

export async function savePack(
  packId: string | null,
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = readForm(data);
  const parsed = packSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      errors: flatten(parsed.error.issues),
      // Returned alongside the error so the override checkbox appears with the
      // reasons next to it, rather than asking for a confirmation of nothing.
      warnings: slugWarnings(raw.slug).map((w) => w.message),
    };
  }

  const input = parsed.data;

  if (await slugTaken(input.slug, packId ?? undefined)) {
    return {
      ok: false,
      errors: { slug: "Another pack already uses this slug." },
      warnings: [],
    };
  }

  const db = getDb();
  const video = input.videoUrl ? parseVideoUrl(input.videoUrl) : null;
  const now = new Date();

  const packValues = {
    slug: input.slug,
    categoryId: input.categoryId,
    // §5a: the platform is detected from the URL, never chosen in the form.
    videoPlatform: video?.platform ?? ("other" as const),
    videoUrl: video?.canonicalUrl ?? null,
    videoId: video?.videoId ?? null,
    repoUrl: input.repoUrl,
    status: input.status,
    hasAffiliate: input.hasAffiliate,
    reviewedAt: now,
    updatedAt: now,
  };

  let id = packId;

  if (id) {
    const [existing] = await db
      .select({ slug: resourcePack.slug, publishedAt: resourcePack.publishedAt })
      .from(resourcePack)
      .where(eq(resourcePack.id, id))
      .limit(1);

    if (!existing) return { ok: false, errors: { form: "That pack is gone." }, warnings: [] };

    await db
      .update(resourcePack)
      .set({
        ...packValues,
        // publishedAt is the first publication, not the latest edit. Rewriting
        // it on every save would make "published 3 days ago" mean "last touched".
        publishedAt:
          input.status === "published" ? (existing.publishedAt ?? now) : null,
      })
      .where(eq(resourcePack.id, id));

    /**
     * CLAUDE.md rule 3. A rename never replaces a slug — the old one was spoken
     * aloud in a video that is still being watched, so it keeps resolving via a
     * redirect row. onConflictDoNothing because renaming A→B→A must not fail on
     * the row left behind by the first rename.
     */
    if (existing.slug !== input.slug) {
      await db
        .insert(slugRedirect)
        .values({ oldSlug: existing.slug, packId: id })
        .onConflictDoNothing({ target: slugRedirect.oldSlug });
    }
  } else {
    const [created] = await db
      .insert(resourcePack)
      .values({
        ...packValues,
        publishedAt: input.status === "published" ? now : null,
      })
      .returning({ id: resourcePack.id });

    if (!created) return { ok: false, errors: { form: "Could not create the pack." }, warnings: [] };
    id = created.id;
  }

  // Replace this pack's translations wholesale. A language cleared in the form
  // has to disappear from the table, not linger as a stale row that the gap
  // dashboard would keep counting as done.
  await db.delete(resourcePackI18n).where(eq(resourcePackI18n.packId, id));

  if (input.translations.length > 0) {
    await db.insert(resourcePackI18n).values(
      input.translations.map((t) => ({
        packId: id,
        locale: t.locale as Locale,
        title: t.title,
        summary: t.summary || null,
        notesMd: t.notesMd || null,
      })),
    );
  }

  revalidatePath("/admin/resources");
  redirect(`/admin/resources/${id}?saved=1`);
}

export async function deletePack(packId: string): Promise<void> {
  await requireAdmin();

  const db = getDb();

  /**
   * Only drafts. A published pack has a slug that may already have been said out
   * loud, and deleting it breaks that URL permanently — rule 3's whole point.
   * Unpublish first; the row stays and the short link keeps resolving.
   */
  const deleted = await db
    .delete(resourcePack)
    .where(and(eq(resourcePack.id, packId), eq(resourcePack.status, "draft")))
    .returning({ id: resourcePack.id });

  if (deleted.length === 0) {
    throw new Error(
      "Only drafts can be deleted. Unpublish first — a published slug may already be in a video.",
    );
  }

  revalidatePath("/admin/resources");
  redirect("/admin/resources");
}
