"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { repoEntry, repoEntryI18n, repoSyncChange } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { repoTaken } from "@/lib/queries/admin-repos";
import { LOCALES, type Locale } from "@/lib/locales";
import { flattenIssues, type FormState } from "@/lib/form-state";
import { caveatWarnings, githubUrlFor, repoSchema } from "@/lib/validation/repo";

/**
 * BUILD_PLAN.md §3 and §12. CLAUDE.md rule 7.
 *
 * requireAdmin() runs first in every action. A server action is a public HTTP
 * endpoint, and the page that rendered the form having checked the session says
 * nothing about who is posting to it a week later.
 *
 * Nothing but async functions may be exported from a "use server" module.
 */

function readForm(data: FormData) {
  const str = (key: string) => {
    const value = data.get(key);
    return typeof value === "string" ? value.trim() : "";
  };

  const translations = LOCALES.flatMap((locale) => {
    const fields = {
      oneLiner: str(`oneLiner.${locale}`),
      forWhom: str(`forWhom.${locale}`),
      notForYouIf: str(`notForYouIf.${locale}`),
      replaces: str(`replaces.${locale}`),
      theCatch: str(`theCatch.${locale}`),
    };

    // A language nobody has touched is an absent row, not an empty one. Writing
    // blanks would make the §5 translation-gap dashboard report every entry as
    // fully translated into languages that have never been written.
    if (!Object.values(fields).some(Boolean)) return [];

    return [{ locale, ...fields }];
  });

  return {
    owner: str("owner"),
    name: str("name"),
    categoryId: str("categoryId") || null,
    status: str("status") || "maintained",
    supersededByUrl: str("supersededByUrl") || null,
    contentStatus: str("contentStatus") === "published" ? "published" : "draft",
    hasAffiliate: data.get("hasAffiliate") === "on",
    caveatOverride: data.get("caveatOverride") === "on",
    translations,
  };
}

/**
 * Every text field, by its form name, so a rejected save redisplays exactly what
 * was typed. Checkboxes are excluded — they are re-derived from the state the
 * form already renders, and a stale one would silently re-tick an override.
 */
function echo(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (
      typeof value === "string" &&
      key !== "caveatOverride" &&
      key !== "hasAffiliate"
    ) {
      values[key] = value;
    }
  }
  return values;
}

/** The English caveat warnings, as plain strings for the form. */
function warningsFor(raw: ReturnType<typeof readForm>): string[] {
  const english = raw.translations.find((t) => t.locale === "en");
  return english ? caveatWarnings(english).map((w) => w.message) : [];
}

export async function saveRepo(
  entryId: string | null,
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = readForm(data);
  const parsed = repoSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      errors: flattenIssues(parsed.error.issues),
      warnings: warningsFor(raw),
      values: echo(data),
    };
  }

  const input = parsed.data;

  if (await repoTaken(input.owner, input.name, entryId ?? undefined)) {
    return {
      ok: false,
      errors: { name: "That repository is already in the library." },
      warnings: warningsFor(raw),
      values: echo(data),
    };
  }

  const db = getDb();
  const now = new Date();

  const entryValues = {
    owner: input.owner,
    name: input.name,
    // Derived, never typed. See githubUrlFor().
    githubUrl: githubUrlFor(input.owner, input.name),
    categoryId: input.categoryId,
    status: input.status,
    supersededByUrl: input.supersededByUrl,
    contentStatus: input.contentStatus,
    hasAffiliate: input.hasAffiliate,
    // Rule 4: saving is a human looking at the entry, which is what reviewed_at
    // records. The sync job writes synced_at and never touches this one.
    reviewedAt: now,
    updatedAt: now,
  };

  let id = entryId;

  if (id) {
    const [existing] = await db
      .select({ publishedAt: repoEntry.publishedAt })
      .from(repoEntry)
      .where(eq(repoEntry.id, id))
      .limit(1);

    if (!existing) {
      return {
        ok: false,
        errors: { form: "That entry is gone." },
        warnings: [],
        values: echo(data),
      };
    }

    await db
      .update(repoEntry)
      .set({
        ...entryValues,
        // First publication, not the latest edit. Rewriting it every save would
        // turn "published in March" into "last touched on Tuesday".
        publishedAt:
          input.contentStatus === "published"
            ? (existing.publishedAt ?? now)
            : null,
      })
      .where(eq(repoEntry.id, id));
  } else {
    const [created] = await db
      .insert(repoEntry)
      .values({
        ...entryValues,
        publishedAt: input.contentStatus === "published" ? now : null,
      })
      .returning({ id: repoEntry.id });

    if (!created) {
      return {
        ok: false,
        errors: { form: "Could not create the entry." },
        warnings: [],
        values: echo(data),
      };
    }
    id = created.id;
  }

  // Replaced wholesale: a language cleared in the form has to disappear from the
  // table rather than linger as a stale row the gap dashboard counts as done.
  await db.delete(repoEntryI18n).where(eq(repoEntryI18n.entryId, id));

  if (input.translations.length > 0) {
    await db.insert(repoEntryI18n).values(
      input.translations.map((t) => ({
        entryId: id,
        locale: t.locale as Locale,
        oneLiner: t.oneLiner,
        forWhom: t.forWhom || null,
        notForYouIf: t.notForYouIf || null,
        replaces: t.replaces || null,
        theCatch: t.theCatch || null,
      })),
    );
  }

  revalidatePath("/admin/repos");
  redirect(`/admin/repos/${id}?saved=1`);
}

export async function deleteRepo(entryId: string): Promise<void> {
  await requireAdmin();

  /**
   * Drafts only, and rule 4 is the reason rather than caution about data loss.
   * A published entry has a URL that has been linked and indexed, and the whole
   * argument of §8 is that the useful thing to do with a dead recommendation is
   * mark it, not remove it. Unpublish, or set the status to superseded and say
   * what replaced it — both keep the page answering the question it was found by.
   */
  const deleted = await getDb()
    .delete(repoEntry)
    .where(and(eq(repoEntry.id, entryId), eq(repoEntry.contentStatus, "draft")))
    .returning({ id: repoEntry.id });

  if (deleted.length === 0) {
    throw new Error(
      "Only drafts can be deleted. Unpublish first, or mark it superseded — a dead entry that points somewhere is worth more than a 404.",
    );
  }

  revalidatePath("/admin/repos");
  redirect("/admin/repos");
}

/**
 * Mark a flagged change as read. §7.
 *
 * The row is kept, not deleted: "this was archived in March and I knew about it"
 * is the fact that makes a later reviewed_at meaningful.
 */
export async function acknowledgeChange(changeId: string): Promise<void> {
  await requireAdmin();

  await getDb()
    .update(repoSyncChange)
    .set({ acknowledgedAt: new Date() })
    .where(
      and(
        eq(repoSyncChange.id, changeId),
        // Only if it is still open. Acknowledging twice would move the timestamp
        // forward and lose when it was actually seen.
        isNull(repoSyncChange.acknowledgedAt),
      ),
    );

  revalidatePath("/admin/health");
  revalidatePath("/admin/repos");
}
