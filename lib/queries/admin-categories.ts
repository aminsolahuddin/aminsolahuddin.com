import "server-only";
import { asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { category, categoryI18n } from "@/db/schema";
import { DEFAULT_LOCALE } from "@/lib/locales";

/**
 * Categories for an editor's select. Machine key plus its English name.
 *
 * Its own module because three content types now need the same list, and the
 * alternative was either a copy per editor or importing it out of
 * admin-repos.ts into a form that has nothing to do with repos.
 *
 * English names, always. The panel is English-only — BUILD_PLAN.md §2 — and a
 * select whose options changed language would make "which category was that
 * one?" a question with two answers.
 */
export async function listCategoryOptions(): Promise<
  { id: string; key: string; name: string }[]
> {
  return getDb()
    .select({
      id: category.id,
      key: category.key,
      name: categoryI18n.name,
    })
    .from(category)
    .innerJoin(categoryI18n, eq(categoryI18n.categoryId, category.id))
    .where(eq(categoryI18n.locale, DEFAULT_LOCALE))
    .orderBy(asc(category.sortOrder));
}
