import "server-only";

import { and, asc, count, desc, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  category,
  categoryI18n,
  resourceItem,
  resourceItemI18n,
  resourcePack,
  resourcePackI18n,
} from "@/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locales";

/**
 * Admin-side reads. These differ from the public ones in lib/queries/resource-pack.ts
 * in two ways that matter, and the two files stay separate because of them.
 *
 * Drafts are visible here and nowhere else. Every public query filters on
 * `status = 'published'`; if the admin variants lived in the same module behind
 * a boolean, one forgotten argument would publish a draft.
 *
 * Nothing falls back to English. The editor has to show what is actually stored
 * per language — an empty Malay tab means no Malay row, and quietly filling it
 * with the English text is how a translation gets "finished" without anyone
 * writing it.
 */

export interface AdminPackRow {
  id: string;
  slug: string;
  status: "draft" | "published";
  title: string | null;
  categoryName: string | null;
  itemCount: number;
  missingLocales: Locale[];
  publishedAt: Date | null;
  updatedAt: Date;
}

export async function listAdminPacks(): Promise<AdminPackRow[]> {
  const db = getDb();

  const packs = await db
    .select({
      id: resourcePack.id,
      slug: resourcePack.slug,
      status: resourcePack.status,
      publishedAt: resourcePack.publishedAt,
      updatedAt: resourcePack.updatedAt,
      categoryId: resourcePack.categoryId,
    })
    .from(resourcePack)
    .orderBy(desc(resourcePack.updatedAt));

  if (packs.length === 0) return [];

  const ids = packs.map((p) => p.id);

  const [text, counts, categoryNames] = await Promise.all([
    db
      .select({
        packId: resourcePackI18n.packId,
        locale: resourcePackI18n.locale,
        title: resourcePackI18n.title,
      })
      .from(resourcePackI18n)
      .where(inArray(resourcePackI18n.packId, ids)),
    db
      .select({ packId: resourceItem.packId, n: count() })
      .from(resourceItem)
      .where(inArray(resourceItem.packId, ids))
      .groupBy(resourceItem.packId),
    db
      .select({ categoryId: categoryI18n.categoryId, name: categoryI18n.name })
      .from(categoryI18n)
      .where(eq(categoryI18n.locale, DEFAULT_LOCALE)),
  ]);

  const titles = new Map<string, Map<string, string>>();
  for (const row of text) {
    const byLocale = titles.get(row.packId) ?? new Map<string, string>();
    byLocale.set(row.locale, row.title);
    titles.set(row.packId, byLocale);
  }

  const countByPack = new Map(counts.map((c) => [c.packId, Number(c.n)]));
  const nameByCategory = new Map(categoryNames.map((c) => [c.categoryId, c.name]));

  return packs.map((pack) => {
    const byLocale = titles.get(pack.id);

    return {
      id: pack.id,
      slug: pack.slug,
      status: pack.status,
      title: byLocale?.get(DEFAULT_LOCALE) ?? null,
      categoryName: pack.categoryId
        ? (nameByCategory.get(pack.categoryId) ?? null)
        : null,
      itemCount: countByPack.get(pack.id) ?? 0,
      // Surfaced in the list, not just in the editor: BUILD_PLAN.md §4 wants
      // translation gaps visible without opening every record to find them.
      missingLocales: LOCALES.filter((l) => !byLocale?.has(l)),
      publishedAt: pack.publishedAt,
      updatedAt: pack.updatedAt,
    };
  });
}

export interface AdminItem {
  id: string;
  kind: "code" | "file" | "link" | "command";
  url: string | null;
  body: string | null;
  lang: string | null;
  isAffiliate: boolean;
  sortOrder: number;
  translations: Partial<Record<Locale, { label: string; note: string }>>;
}

export interface AdminPackDetail {
  id: string;
  slug: string;
  status: "draft" | "published";
  categoryId: string | null;
  videoUrl: string | null;
  repoUrl: string | null;
  hasAffiliate: boolean;
  translations: Partial<
    Record<Locale, { title: string; summary: string; notesMd: string }>
  >;
  items: AdminItem[];
}

export async function getAdminPack(id: string): Promise<AdminPackDetail | null> {
  const db = getDb();

  const [pack] = await db
    .select()
    .from(resourcePack)
    .where(eq(resourcePack.id, id))
    .limit(1);

  if (!pack) return null;

  const [text, items] = await Promise.all([
    db
      .select()
      .from(resourcePackI18n)
      .where(eq(resourcePackI18n.packId, id)),
    db
      .select()
      .from(resourceItem)
      .where(eq(resourceItem.packId, id))
      .orderBy(asc(resourceItem.sortOrder)),
  ]);

  const itemText = items.length
    ? await db
        .select()
        .from(resourceItemI18n)
        .where(
          inArray(
            resourceItemI18n.itemId,
            items.map((i) => i.id),
          ),
        )
    : [];

  const translations = {} as AdminPackDetail["translations"];
  for (const row of text) {
    translations[row.locale] = {
      title: row.title,
      summary: row.summary ?? "",
      notesMd: row.notesMd ?? "",
    };
  }

  const itemTextByItem = new Map<string, typeof itemText>();
  for (const row of itemText) {
    const list = itemTextByItem.get(row.itemId);
    if (list) list.push(row);
    else itemTextByItem.set(row.itemId, [row]);
  }

  return {
    id: pack.id,
    slug: pack.slug,
    status: pack.status,
    categoryId: pack.categoryId,
    videoUrl: pack.videoUrl,
    repoUrl: pack.repoUrl,
    hasAffiliate: pack.hasAffiliate,
    translations,
    items: items.map((item) => {
      const byLocale: AdminItem["translations"] = {};
      for (const row of itemTextByItem.get(item.id) ?? []) {
        byLocale[row.locale] = { label: row.label, note: row.note ?? "" };
      }

      return {
        id: item.id,
        kind: item.kind,
        url: item.url,
        body: item.body,
        lang: item.lang,
        isAffiliate: item.isAffiliate,
        sortOrder: item.sortOrder,
        translations: byLocale,
      };
    }),
  };
}

/** Categories for the editor's select. Machine key plus its English name. */
export async function listAdminCategories(): Promise<
  { id: string; key: string; name: string }[]
> {
  const db = getDb();

  const rows = await db
    .select({
      id: category.id,
      key: category.key,
      name: categoryI18n.name,
      sortOrder: category.sortOrder,
    })
    .from(category)
    .innerJoin(categoryI18n, eq(categoryI18n.categoryId, category.id))
    .where(eq(categoryI18n.locale, DEFAULT_LOCALE))
    .orderBy(asc(category.sortOrder));

  return rows.map(({ id, key, name }) => ({ id, key, name }));
}

/** True if the slug is taken by a different pack. Used before insert and update. */
export async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const db = getDb();

  /**
   * `and(...)`, not `&&`. Drizzle conditions are objects, so `a && b` evaluates
   * to `b` and silently drops the first condition — here that would have made
   * every slug look free during an edit, and the unique index would have been
   * the thing that caught it, as a 500 rather than a form error.
   */
  const rows = await db
    .select({ id: resourcePack.id })
    .from(resourcePack)
    .where(
      exceptId
        ? and(eq(resourcePack.slug, slug), ne(resourcePack.id, exceptId))
        : eq(resourcePack.slug, slug),
    )
    .limit(1);

  return rows.length > 0;
}
