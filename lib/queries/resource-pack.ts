import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  category,
  categoryI18n,
  resourceItem,
  resourceItemI18n,
  resourcePack,
  resourcePackI18n,
} from "@/db/schema";
import { routing, type Locale } from "@/i18n/routing";
import { parseVideoUrl, type ParsedVideoUrl } from "@/lib/video-url";

/**
 * BUILD_PLAN.md §4: a missing translation renders the English row and says so.
 * It never machine-translates and never shows a half-empty page.
 *
 * `translated` is returned per record rather than per page because the two can
 * disagree — a pack's summary may be translated while an item added later is
 * not. One flag for the whole page would either hide that or overstate it, and
 * the reader is the one who has to know which sentence they are reading.
 */

const BASE: Locale = routing.defaultLocale;

export type ItemKind = "code" | "file" | "link" | "command";

export interface PackItem {
  id: string;
  kind: ItemKind;
  url: string | null;
  body: string | null;
  lang: string | null;
  isAffiliate: boolean;
  label: string;
  note: string | null;
  translated: boolean;
}

export interface PackDetail {
  slug: string;
  title: string;
  summary: string | null;
  notesMd: string | null;
  translated: boolean;
  video: ParsedVideoUrl | null;
  repoUrl: string | null;
  hasAffiliate: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  category: { key: string; name: string } | null;
  items: PackItem[];
}

/** Picks the requested locale, else the base one. Reports which it used. */
function pick<T extends { locale: string }>(
  rows: T[],
  locale: Locale,
): { row: T; translated: boolean } | null {
  const exact = rows.find((r) => r.locale === locale);
  if (exact) return { row: exact, translated: true };

  const base = rows.find((r) => r.locale === BASE);
  if (base) return { row: base, translated: locale === BASE };

  return null;
}

export async function getPackBySlug(
  slug: string,
  locale: Locale,
): Promise<PackDetail | null> {
  const db = getDb();
  const locales = locale === BASE ? [BASE] : [locale, BASE];

  const [pack] = await db
    .select()
    .from(resourcePack)
    .where(
      and(eq(resourcePack.slug, slug), eq(resourcePack.status, "published")),
    )
    .limit(1);

  if (!pack) return null;

  const packText = await db
    .select()
    .from(resourcePackI18n)
    .where(
      and(
        eq(resourcePackI18n.packId, pack.id),
        inArray(resourcePackI18n.locale, locales),
      ),
    );

  const chosen = pick(packText, locale);

  /**
   * No English row means the pack has no title in any language a reader can be
   * given. Publishing that is a data error rather than a missing translation,
   * so it is treated as absent instead of rendered as an untitled page.
   */
  if (!chosen) return null;

  const items = await db
    .select()
    .from(resourceItem)
    .where(eq(resourceItem.packId, pack.id))
    .orderBy(asc(resourceItem.sortOrder));

  const itemText = items.length
    ? await db
        .select()
        .from(resourceItemI18n)
        .where(
          and(
            inArray(
              resourceItemI18n.itemId,
              items.map((i) => i.id),
            ),
            inArray(resourceItemI18n.locale, locales),
          ),
        )
    : [];

  const byItem = new Map<string, typeof itemText>();
  for (const row of itemText) {
    const list = byItem.get(row.itemId);
    if (list) list.push(row);
    else byItem.set(row.itemId, [row]);
  }

  let cat: PackDetail["category"] = null;
  if (pack.categoryId) {
    const [row] = await db
      .select({ key: category.key })
      .from(category)
      .where(eq(category.id, pack.categoryId))
      .limit(1);

    if (row) {
      const names = await db
        .select()
        .from(categoryI18n)
        .where(
          and(
            eq(categoryI18n.categoryId, pack.categoryId),
            inArray(categoryI18n.locale, locales),
          ),
        );
      const name = pick(names, locale);
      // The key is a machine name and is never shown. A category with no name
      // row at all is dropped rather than rendered as its key.
      if (name) cat = { key: row.key, name: name.row.name };
    }
  }

  return {
    slug: pack.slug,
    title: chosen.row.title,
    summary: chosen.row.summary,
    notesMd: chosen.row.notesMd,
    translated: chosen.translated,
    video: pack.videoUrl ? parseVideoUrl(pack.videoUrl) : null,
    repoUrl: pack.repoUrl,
    hasAffiliate: pack.hasAffiliate,
    publishedAt: pack.publishedAt,
    updatedAt: pack.updatedAt,
    category: cat,
    items: items.flatMap((item) => {
      const text = pick(byItem.get(item.id) ?? [], locale);
      // An item with no label in any language cannot be described to a reader.
      // Dropping it is better than rendering a labelless row.
      if (!text) return [];

      return [
        {
          id: item.id,
          kind: item.kind,
          url: item.url,
          body: item.body,
          lang: item.lang,
          isAffiliate: item.isAffiliate,
          label: text.row.label,
          note: text.row.note,
          translated: text.translated,
        },
      ];
    }),
  };
}

/** Every published slug, for generateStaticParams and the sitemap. */
export async function getPublishedSlugs(): Promise<string[]> {
  const rows = await getDb()
    .select({ slug: resourcePack.slug })
    .from(resourcePack)
    .where(eq(resourcePack.status, "published"));

  return rows.map((r) => r.slug);
}
