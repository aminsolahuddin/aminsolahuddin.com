"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { linkHealth, tool, toolI18n } from "@/db/schema";
import { requireAdmin } from "@/lib/require-admin";
import { toolNameTaken } from "@/lib/queries/admin-tools";
import { LOCALES, type Locale } from "@/lib/locales";
import { flattenIssues, type FormState } from "@/lib/form-state";
import { toolSchema, toolWarnings } from "@/lib/validation/tool";

/**
 * BUILD_PLAN.md §3 and §12, Phase 4. CLAUDE.md rule 7.
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
      whyIUseIt: str(`whyIUseIt.${locale}`),
      caveat: str(`caveat.${locale}`),
    };

    // A language nobody has touched is an absent row, not an empty one. Writing
    // blanks would make the §4 translation-gap dashboard report every tool as
    // translated into languages nobody has written.
    if (!Object.values(fields).some(Boolean)) return [];

    return [{ locale, ...fields }];
  });

  const sortOrder = Number.parseInt(str("sortOrder"), 10);

  return {
    name: str("name"),
    vendor: str("vendor") || null,
    canonicalUrl: str("canonicalUrl"),
    affiliateUrl: str("affiliateUrl") || null,
    /**
     * §3's honest default is the checked box, and an unchecked one posts
     * nothing at all — so "not personally used" is what the absence means. That
     * is the right way round: forgetting to touch this field claims less, not
     * more.
     */
    personallyUsed: data.get("personallyUsed") === "on",
    categoryId: str("categoryId") || null,
    sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
    translations,
  };
}

/**
 * Every text field, by its form name, so a rejected save redisplays exactly what
 * was typed. The checkbox is excluded — it is re-derived from the state the form
 * already renders, and a stale one would silently re-tick a claim about having
 * used something.
 */
function echo(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of data.entries()) {
    if (typeof value === "string" && key !== "personallyUsed") {
      values[key] = value;
    }
  }
  return values;
}

/** The English warnings, as plain strings for the form. */
function warningsFor(raw: ReturnType<typeof readForm>): string[] {
  const english = raw.translations.find((t) => t.locale === "en");

  return toolWarnings(
    { whyIUseIt: english?.whyIUseIt ?? "", caveat: english?.caveat ?? "" },
    { personallyUsed: raw.personallyUsed, affiliateUrl: raw.affiliateUrl ?? "" },
  ).map((w) => w.message);
}

export async function saveTool(
  toolId: string | null,
  _prev: FormState,
  data: FormData,
): Promise<FormState> {
  await requireAdmin();

  const raw = readForm(data);
  const parsed = toolSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      errors: flattenIssues(parsed.error.issues),
      warnings: warningsFor(raw),
      values: echo(data),
    };
  }

  const input = parsed.data;

  if (await toolNameTaken(input.name, toolId ?? undefined)) {
    return {
      ok: false,
      errors: { name: "There is already a tool with that name." },
      warnings: warningsFor(raw),
      values: echo(data),
    };
  }

  const db = getDb();
  const now = new Date();

  const values = {
    name: input.name,
    vendor: input.vendor,
    canonicalUrl: input.canonicalUrl,
    affiliateUrl: input.affiliateUrl,
    personallyUsed: input.personallyUsed,
    categoryId: input.categoryId,
    sortOrder: input.sortOrder,
    updatedAt: now,
  };

  let id = toolId;

  if (id) {
    const updated = await db
      .update(tool)
      .set(values)
      .where(eq(tool.id, id))
      .returning({ id: tool.id });

    if (updated.length === 0) {
      return {
        ok: false,
        errors: { form: "That tool is gone." },
        warnings: [],
        values: echo(data),
      };
    }
  } else {
    const [created] = await db.insert(tool).values(values).returning({ id: tool.id });

    if (!created) {
      return {
        ok: false,
        errors: { form: "Could not create the tool." },
        warnings: [],
        values: echo(data),
      };
    }
    id = created.id;
  }

  // Replaced wholesale: a language cleared in the form has to disappear from the
  // table rather than linger as a stale row the gap dashboard counts as done.
  await db.delete(toolI18n).where(eq(toolI18n.toolId, id));

  if (input.translations.length > 0) {
    await db.insert(toolI18n).values(
      input.translations.map((t) => ({
        toolId: id,
        locale: t.locale as Locale,
        whyIUseIt: t.whyIUseIt || null,
        caveat: t.caveat || null,
      })),
    );
  }

  // The public page is force-dynamic and needs no revalidation. Only the admin
  // list is cached between navigations.
  revalidatePath("/admin/tools");
  redirect(`/admin/tools/${id}?saved=1`);
}

/**
 * Delete a tool, its translations, and the health rows for its URLs.
 *
 * Unlike a repo entry, this is not fenced behind a draft state, and rule 4 is
 * not being bent: rule 4 is about pages that have been linked. A tool has no URL
 * of its own — §2 gives the section one route for all of them — so there is no
 * address that starts 404ing and nothing a reader could have bookmarked. A tool
 * that has been dropped is a row that should stop being recommended, and there
 * is no marker on /tools that would say that better than its absence.
 *
 * The link_health rows go with it. They are keyed by target id with no foreign
 * key behind them, so leaving them would leave the dashboard reporting failures
 * against "Unknown target" that no page can fix.
 */
export async function deleteTool(toolId: string): Promise<void> {
  await requireAdmin();

  const db = getDb();

  const deleted = await db
    .delete(tool)
    .where(eq(tool.id, toolId))
    .returning({ id: tool.id });

  if (deleted.length === 0) {
    throw new Error("That tool is already gone.");
  }

  await db
    .delete(linkHealth)
    .where(and(eq(linkHealth.targetType, "tool"), eq(linkHealth.targetId, toolId)));

  revalidatePath("/admin/tools");
  revalidatePath("/admin/health");
  redirect("/admin/tools");
}
