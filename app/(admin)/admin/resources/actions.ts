"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import {
  resourceItem,
  resourceItemI18n,
  resourcePack,
  resourcePackI18n,
  slugRedirect,
} from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { slugTaken } from "@/lib/queries/admin-packs";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locales";
import { packSchema, slugWarnings } from "@/lib/validation/pack";
import { parseVideoUrl } from "@/lib/video-url";
import { flattenIssues, type FormState } from "@/lib/form-state";

/**
 * CLAUDE.md rule 7: validate at the edge. requireAdmin() runs first in every
 * action here — a server action is a public HTTP endpoint, and the page that
 * renders the form having checked the session says nothing about who is posting
 * to it afterwards.
 *
 * Nothing but async functions may be exported from this file. FormState and
 * EMPTY_STATE live in @/lib/form-state for that reason; see the comment there.
 */

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

/**
 * Items arrive as flat form fields — items.0.kind, items.0.label.ms — because
 * that is what a plain <form> can express. This regroups them by index.
 *
 * An item that already exists carries its id. New ones do not, and are inserted.
 * Anything whose id was in the database but not in the submission is deleted, so
 * removing a row in the editor removes it here.
 */
function readItems(data: FormData) {
  const indexes = new Set<number>();
  for (const key of data.keys()) {
    const match = /^items\.(\d+)\./.exec(key);
    if (match?.[1] !== undefined) indexes.add(Number(match[1]));
  }

  const str = (key: string) => {
    const value = data.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  return [...indexes]
    .sort((a, b) => a - b)
    .flatMap((index, position) => {
      const at = (field: string) => str(`items.${index}.${field}`);

      const translations = LOCALES.flatMap((locale) => {
        const label = str(`items.${index}.label.${locale}`);
        const note = str(`items.${index}.note.${locale}`);
        // Same rule as the pack: an untouched language is an absent row, never
        // an empty one, or the translation-gap dashboard reads as complete.
        if (!label && !note) return [];
        return [{ locale, label, note }];
      });

      // A row with no English label describes nothing a reader could be shown.
      // Dropping it silently beats saving an item that renders as a blank line.
      if (!translations.some((t) => t.locale === DEFAULT_LOCALE && t.label)) {
        return [];
      }

      const kind = at("kind");

      return [
        {
          id: at("id") || null,
          kind: (["code", "file", "link", "command"] as const).includes(
            kind as "code",
          )
            ? (kind as "code" | "file" | "link" | "command")
            : ("link" as const),
          url: at("url") || null,
          body: at("body") || null,
          lang: at("lang") || null,
          isAffiliate: data.get(`items.${index}.isAffiliate`) === "on",
          // Renumbered from the submitted order, so dragging or deleting a row
          // never leaves gaps or ties in sort_order.
          sortOrder: (position + 1) * 10,
          translations,
        },
      ];
    });
}

/**
 * Every text field, by its form name, so a rejected save can redisplay exactly
 * what was typed. Checkboxes are excluded — they are re-derived from the state
 * the form already renders, and a stale one would silently re-tick an override.
 */
function echo(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string" && key !== "slugOverride" && key !== "hasAffiliate") {
      values[key] = value;
    }
  }
  return values;
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
      errors: flattenIssues(parsed.error.issues),
      // Returned alongside the error so the override checkbox appears with the
      // reasons next to it, rather than asking for a confirmation of nothing.
      warnings: slugWarnings(raw.slug).map((w) => w.message),
      values: echo(data),
    };
  }

  const input = parsed.data;

  if (await slugTaken(input.slug, packId ?? undefined)) {
    return {
      ok: false,
      errors: { slug: "Another pack already uses this slug." },
      warnings: [],
      values: echo(data),
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

    if (!existing) {
      return {
        ok: false,
        errors: { form: "That pack is gone." },
        warnings: [],
        values: echo(data),
      };
    }

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
     *
     * Only if it was ever published. A draft slug has never been anywhere: no
     * video says it, no page has served it, and there is nothing to keep alive.
     * Writing a redirect for one would leave a permanent row behind every typo
     * corrected while drafting — and each of those rows quietly reserves a slug
     * that a later pack can then never use.
     *
     * The test is publishedAt rather than the current status, because a pack
     * that was published and later unpublished still had its slug in the world.
     */
    if (existing.slug !== input.slug && existing.publishedAt !== null) {
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

    if (!created) {
      return {
        ok: false,
        errors: { form: "Could not create the pack." },
        warnings: [],
        values: echo(data),
      };
    }
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

  await syncItems(id, readItems(data));

  revalidatePath("/admin/resources");
  redirect(`/admin/resources/${id}?saved=1`);
}

/**
 * Bring the pack's items in line with what was submitted.
 *
 * Existing rows are updated in place rather than replaced. Their ids are
 * referenced by link_health, and delete-then-insert would orphan every health
 * record on every save — the checks would look clean because their history had
 * quietly been thrown away, which is the failure §8 is built to prevent.
 */
async function syncItems(
  packId: string,
  items: ReturnType<typeof readItems>,
): Promise<void> {
  const db = getDb();

  const existing = await db
    .select({ id: resourceItem.id })
    .from(resourceItem)
    .where(eq(resourceItem.packId, packId));

  const submitted = new Set(items.map((i) => i.id).filter(Boolean));
  const removed = existing.filter((row) => !submitted.has(row.id));

  if (removed.length > 0) {
    await db.delete(resourceItem).where(
      inArray(
        resourceItem.id,
        removed.map((r) => r.id),
      ),
    );
  }

  for (const item of items) {
    const values = {
      packId,
      kind: item.kind,
      url: item.url,
      body: item.body,
      lang: item.lang,
      isAffiliate: item.isAffiliate,
      sortOrder: item.sortOrder,
    };

    let itemId = item.id;

    if (itemId) {
      await db.update(resourceItem).set(values).where(eq(resourceItem.id, itemId));
    } else {
      const [created] = await db
        .insert(resourceItem)
        .values(values)
        .returning({ id: resourceItem.id });
      if (!created) continue;
      itemId = created.id;
    }

    // Translations are replaced wholesale, same as the pack's: a language
    // cleared in the editor has to disappear rather than linger.
    await db.delete(resourceItemI18n).where(eq(resourceItemI18n.itemId, itemId));

    if (item.translations.length > 0) {
      await db.insert(resourceItemI18n).values(
        item.translations.map((t) => ({
          itemId,
          locale: t.locale,
          label: t.label,
          note: t.note || null,
        })),
      );
    }
  }
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
