import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { categoryI18n, linkHealth, tool, toolI18n } from "@/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locales";
import { toolWarnings } from "@/lib/validation/tool";

/**
 * Admin-side reads for the tools page, separate from lib/queries/tool.ts for the
 * same reason the repo queries are split.
 *
 * Nothing here drops a row. The public query hides a tool with no English reason
 * — that is the point of it — and an editor that hid the same rows would make a
 * half-finished tool invisible in the one place it can be finished.
 *
 * Nothing falls back to English either. An empty Malay tab has to look empty, or
 * a translation gets marked done without anybody writing it.
 */

export interface AdminToolRow {
  id: string;
  name: string;
  vendor: string | null;
  categoryName: string | null;
  personallyUsed: boolean;
  hasAffiliate: boolean;
  sortOrder: number;
  /** Null when there is no English row at all. */
  whyIUseIt: string | null;
  /** How many §3 warnings the English row still carries. */
  warnings: number;
  /** True when the public page will not list it: no English reason. */
  hidden: boolean;
  missingLocales: Locale[];
  updatedAt: Date;
}

export async function listAdminTools(): Promise<AdminToolRow[]> {
  const db = getDb();

  const tools = await db
    .select({
      id: tool.id,
      name: tool.name,
      vendor: tool.vendor,
      affiliateUrl: tool.affiliateUrl,
      personallyUsed: tool.personallyUsed,
      sortOrder: tool.sortOrder,
      categoryId: tool.categoryId,
      updatedAt: tool.updatedAt,
    })
    .from(tool)
    .orderBy(asc(tool.sortOrder), asc(tool.name));

  if (tools.length === 0) return [];

  const ids = tools.map((t) => t.id);

  const [text, categoryNames] = await Promise.all([
    db.select().from(toolI18n).where(inArray(toolI18n.toolId, ids)),
    db
      .select({ categoryId: categoryI18n.categoryId, name: categoryI18n.name })
      .from(categoryI18n)
      .where(eq(categoryI18n.locale, DEFAULT_LOCALE)),
  ]);

  const byTool = new Map<string, typeof text>();
  for (const row of text) {
    const list = byTool.get(row.toolId);
    if (list) list.push(row);
    else byTool.set(row.toolId, [row]);
  }

  const nameByCategory = new Map(categoryNames.map((c) => [c.categoryId, c.name]));

  return tools.map((entry) => {
    const rows = byTool.get(entry.id) ?? [];
    const english = rows.find((r) => r.locale === DEFAULT_LOCALE);
    const whyIUseIt = english?.whyIUseIt?.trim() || null;

    return {
      id: entry.id,
      name: entry.name,
      vendor: entry.vendor,
      categoryName: entry.categoryId
        ? (nameByCategory.get(entry.categoryId) ?? null)
        : null,
      personallyUsed: entry.personallyUsed,
      hasAffiliate: entry.affiliateUrl !== null,
      sortOrder: entry.sortOrder,
      whyIUseIt,
      /**
       * Counted in the list rather than only inside the editor, for the reason
       * §3 gives about the repo caveats: a gap you have to open every record to
       * find is a gap nobody finds.
       */
      warnings: toolWarnings(
        {
          whyIUseIt: english?.whyIUseIt ?? "",
          caveat: english?.caveat ?? "",
        },
        {
          personallyUsed: entry.personallyUsed,
          affiliateUrl: entry.affiliateUrl ?? "",
        },
      ).length,
      hidden: whyIUseIt === null,
      missingLocales: LOCALES.filter((l) => !rows.some((r) => r.locale === l)),
      updatedAt: entry.updatedAt,
    };
  });
}

export interface AdminToolDetail {
  id: string;
  name: string;
  vendor: string | null;
  canonicalUrl: string;
  affiliateUrl: string | null;
  personallyUsed: boolean;
  categoryId: string | null;
  sortOrder: number;
  translations: Partial<Record<Locale, { whyIUseIt: string; caveat: string }>>;
  /** What the weekly job knows about this tool's URLs. §8 */
  links: {
    url: string;
    lastCheckedAt: Date | null;
    httpStatus: number | null;
    consecutiveFailures: number;
  }[];
}

export async function getAdminTool(id: string): Promise<AdminToolDetail | null> {
  const db = getDb();

  const [entry] = await db.select().from(tool).where(eq(tool.id, id)).limit(1);
  if (!entry) return null;

  const [text, links] = await Promise.all([
    db.select().from(toolI18n).where(eq(toolI18n.toolId, id)),
    db
      .select({
        url: linkHealth.url,
        lastCheckedAt: linkHealth.lastCheckedAt,
        httpStatus: linkHealth.httpStatus,
        consecutiveFailures: linkHealth.consecutiveFailures,
      })
      .from(linkHealth)
      .where(and(eq(linkHealth.targetType, "tool"), eq(linkHealth.targetId, id)))
      .orderBy(desc(linkHealth.consecutiveFailures)),
  ]);

  const translations = {} as AdminToolDetail["translations"];
  for (const row of text) {
    translations[row.locale] = {
      whyIUseIt: row.whyIUseIt ?? "",
      caveat: row.caveat ?? "",
    };
  }

  return {
    id: entry.id,
    name: entry.name,
    vendor: entry.vendor,
    canonicalUrl: entry.canonicalUrl,
    affiliateUrl: entry.affiliateUrl,
    personallyUsed: entry.personallyUsed,
    categoryId: entry.categoryId,
    sortOrder: entry.sortOrder,
    translations,
    links,
  };
}

/**
 * True if some other row is already this tool.
 *
 * Compared case-insensitively, and there is no unique index behind it: `tool`
 * has none in §3. Two rows called Neon would both render on /tools, one above
 * the other, and the reader has no way to tell which is the current one — so
 * the check lives here, where the name is being chosen.
 */
export async function toolNameTaken(
  name: string,
  exceptId?: string,
): Promise<boolean> {
  const sameName = sql`lower(${tool.name}) = lower(${name})`;

  const rows = await getDb()
    .select({ id: tool.id })
    .from(tool)
    // `and(...)`, never `&&`. Drizzle conditions are plain objects, so `a && b`
    // evaluates to b and drops the first condition without a word.
    .where(exceptId ? and(sameName, ne(tool.id, exceptId)) : sameName)
    .limit(1);

  return rows.length > 0;
}

/** The next free sort order, so a new tool lands at the end rather than at 0. */
export async function nextToolSortOrder(): Promise<number> {
  const [row] = await getDb()
    .select({ max: sql<number | null>`max(${tool.sortOrder})` })
    .from(tool);

  return (row?.max ?? -10) + 10;
}
