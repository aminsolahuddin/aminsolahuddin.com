import "server-only";
import { asc } from "drizzle-orm";

import { getDb } from "@/db";
import {
  category,
  categoryI18n,
  media,
  mediaI18n,
  post,
  postI18n,
  repoEntry,
  repoEntryI18n,
  resourceItem,
  resourceItemI18n,
  resourcePack,
  resourcePackI18n,
  tool,
  toolI18n,
} from "@/db/schema";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/locales";

/**
 * BUILD_PLAN.md §4: "The admin dashboard shows, per content type, how many
 * entries are missing ms and zh-Hans. Without this the backlog becomes invisible
 * and the feature quietly dies."
 *
 * Translated is not the same as "a row exists". Every content type has one field
 * the public renderer cannot do without — a pack needs a title, a repo entry
 * needs its one-liner, a tool needs the reason it is listed — and a row carrying
 * everything except that field renders the English version with the fallback
 * notice on top. Counting it as done would report the opposite of what a reader
 * sees, so each type below declares the field it is gated on.
 */

/** The locales that can be behind. English is the base; it cannot be missing. */
export const TRANSLATABLE_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export interface UntranslatedRow {
  id: string;
  /** What to call it in the list. Never translated — slugs, names, owner/name. */
  label: string;
  /** Where to write the translation, or null if nothing can edit it yet. */
  adminHref: string | null;
  missing: Locale[];
}

export interface ContentGap {
  key: string;
  label: string;
  /** The field a locale has to fill before it counts. Shown in the UI. */
  gatedOn: string;
  total: number;
  /** Entries missing each locale, keyed by locale. */
  missingCount: Record<string, number>;
  rows: UntranslatedRow[];
}

interface Parent {
  id: string;
  label: string;
  adminHref: string | null;
}

interface Translation {
  parentId: string;
  locale: Locale;
  /** The gate field's value. Null or blank means this locale is not done. */
  gate: string | null;
}

function assemble(
  key: string,
  label: string,
  gatedOn: string,
  parents: Parent[],
  translations: Translation[],
): ContentGap {
  const byParent = new Map<string, Set<Locale>>();
  for (const row of translations) {
    if (!row.gate?.trim()) continue;
    const done = byParent.get(row.parentId) ?? new Set<Locale>();
    done.add(row.locale);
    byParent.set(row.parentId, done);
  }

  const missingCount: Record<string, number> = {};
  for (const locale of TRANSLATABLE_LOCALES) missingCount[locale] = 0;

  const rows: UntranslatedRow[] = [];

  for (const parent of parents) {
    const done = byParent.get(parent.id) ?? new Set<Locale>();
    const missing = TRANSLATABLE_LOCALES.filter((l) => !done.has(l));

    for (const locale of missing) {
      missingCount[locale] = (missingCount[locale] ?? 0) + 1;
    }

    if (missing.length > 0) {
      rows.push({ ...parent, missing });
    }
  }

  return { key, label, gatedOn, total: parents.length, missingCount, rows };
}

/**
 * Every translatable content type, with what is still missing.
 *
 * `category` and `media` carry no admin link because §6's CRUD for them has not
 * been built — categories come from db/seed.ts and there is no media pipeline
 * yet. They are listed anyway rather than hidden: a gap with nowhere to fix it
 * is still a gap, and leaving it off the page would make the backlog look
 * smaller than it is, which is the exact failure §4 is written against.
 */
export async function listTranslationGaps(): Promise<ContentGap[]> {
  const db = getDb();

  const [
    packs,
    packText,
    items,
    itemText,
    repos,
    repoText,
    posts,
    postText,
    tools,
    toolText,
    categories,
    categoryText,
    mediaRows,
    mediaText,
  ] = await Promise.all([
    db
      .select({ id: resourcePack.id, slug: resourcePack.slug })
      .from(resourcePack)
      .orderBy(asc(resourcePack.slug)),
    db
      .select({
        parentId: resourcePackI18n.packId,
        locale: resourcePackI18n.locale,
        gate: resourcePackI18n.title,
      })
      .from(resourcePackI18n),
    db
      .select({ id: resourceItem.id, packId: resourceItem.packId })
      .from(resourceItem)
      .orderBy(asc(resourceItem.sortOrder)),
    db
      .select({
        parentId: resourceItemI18n.itemId,
        locale: resourceItemI18n.locale,
        gate: resourceItemI18n.label,
      })
      .from(resourceItemI18n),
    db
      .select({ id: repoEntry.id, owner: repoEntry.owner, name: repoEntry.name })
      .from(repoEntry)
      .orderBy(asc(repoEntry.name)),
    db
      .select({
        parentId: repoEntryI18n.entryId,
        locale: repoEntryI18n.locale,
        gate: repoEntryI18n.oneLiner,
      })
      .from(repoEntryI18n),
    db.select({ id: post.id, slug: post.slug }).from(post).orderBy(asc(post.slug)),
    db
      .select({
        parentId: postI18n.postId,
        locale: postI18n.locale,
        /**
         * The body, not the title. `title` is NOT NULL so every row has one,
         * and a translated headline over an English article is the case a
         * reader is least able to explain to themselves.
         */
        gate: postI18n.bodyMd,
      })
      .from(postI18n),
    db.select({ id: tool.id, name: tool.name }).from(tool).orderBy(asc(tool.name)),
    db
      .select({
        parentId: toolI18n.toolId,
        locale: toolI18n.locale,
        gate: toolI18n.whyIUseIt,
      })
      .from(toolI18n),
    db
      .select({ id: category.id, key: category.key })
      .from(category)
      .orderBy(asc(category.sortOrder)),
    db
      .select({
        parentId: categoryI18n.categoryId,
        locale: categoryI18n.locale,
        gate: categoryI18n.name,
      })
      .from(categoryI18n),
    db.select({ id: media.id, r2Key: media.r2Key }).from(media),
    db
      .select({
        parentId: mediaI18n.mediaId,
        locale: mediaI18n.locale,
        gate: mediaI18n.altText,
      })
      .from(mediaI18n),
  ]);

  /** Which pack an item belongs to, so its link lands on the pack's editor. */
  const packOfItem = new Map(items.map((i) => [i.id, i.packId]));

  const englishItemLabels = labelsFor(itemText);

  return [
    assemble(
      "resource_pack",
      "Resource packs",
      "title",
      packs.map((p) => ({
        id: p.id,
        label: `/r/${p.slug}`,
        adminHref: `/admin/resources/${p.id}`,
      })),
      packText,
    ),
    assemble(
      "resource_item",
      "Resource items",
      "label",
      items.map((i) => ({
        id: i.id,
        label: englishItemLabels.get(i.id) ?? "(no English label)",
        adminHref: packOfItem.get(i.id)
          ? `/admin/resources/${packOfItem.get(i.id)}`
          : null,
      })),
      itemText,
    ),
    assemble(
      "repo_entry",
      "Repo library",
      "one-liner",
      repos.map((r) => ({
        id: r.id,
        label: `${r.owner}/${r.name}`,
        adminHref: `/admin/repos/${r.id}`,
      })),
      repoText,
    ),
    assemble(
      "post",
      "Writing",
      "body",
      posts.map((p) => ({
        id: p.id,
        label: p.slug,
        adminHref: `/admin/writing/${p.id}`,
      })),
      postText,
    ),
    assemble(
      "tool",
      "Tools",
      "why I use it",
      tools.map((t) => ({
        id: t.id,
        label: t.name,
        adminHref: `/admin/tools/${t.id}`,
      })),
      toolText,
    ),
    assemble(
      "category",
      "Categories",
      "name",
      categories.map((c) => ({ id: c.id, label: c.key, adminHref: null })),
      categoryText,
    ),
    assemble(
      "media",
      "Media alt text",
      "alt text",
      mediaRows.map((m) => ({ id: m.id, label: m.r2Key, adminHref: null })),
      mediaText,
    ),
  ];
}

/** English labels for resource items, so the list names them rather than ids. */
function labelsFor(
  itemText: { parentId: string; locale: Locale; gate: string | null }[],
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const row of itemText) {
    if (row.locale === DEFAULT_LOCALE && row.gate) labels.set(row.parentId, row.gate);
  }
  return labels;
}

/**
 * One number for the whole backlog, for the admin front page.
 *
 * Entries rather than fields: "9 entries need Malay" is a size someone can hold,
 * and it is the unit the work is actually done in.
 */
export async function countTranslationGaps(): Promise<Record<string, number>> {
  const gaps = await listTranslationGaps();

  const totals: Record<string, number> = {};
  for (const locale of TRANSLATABLE_LOCALES) {
    totals[locale] = gaps.reduce(
      (sum, gap) => sum + (gap.missingCount[locale] ?? 0),
      0,
    );
  }
  return totals;
}
