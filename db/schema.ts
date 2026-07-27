import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/**
 * BUILD_PLAN.md §3. The pattern is the same for every content type:
 *
 *   Parent table  = facts that are identical in every language.
 *   *_i18n table  = prose a human wrote, per language.
 *
 * This is structural, not a convention. There is no path by which a repo name or
 * an SPDX licence can end up translated, because those columns do not exist on
 * any _i18n table and cannot be reached from one.
 */

export const locale = pgEnum("locale", ["en", "ms", "zh-Hans"]);
export const contentStatus = pgEnum("content_status", ["draft", "published"]);
export const videoPlatform = pgEnum("video_platform", [
  "youtube",
  "tiktok",
  "instagram",
  "other",
]);
export const repoStatus = pgEnum("repo_status", [
  "maintained",
  "slowing",
  "archived",
  "superseded",
]);
export const itemKind = pgEnum("item_kind", ["code", "file", "link", "command"]);
export const targetType = pgEnum("target_type", [
  "resource_pack",
  "resource_item",
  "repo_entry",
  "post",
  "tool",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// ---------------------------------------------------------------------------
// media
// ---------------------------------------------------------------------------

export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  r2Key: text("r2_key").notNull().unique(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  blurhash: text("blurhash"),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: timestamps.createdAt,
});

/** Alt text is translatable, and it is not optional. §3: reject uploads without it. */
export const mediaI18n = pgTable(
  "media_i18n",
  {
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    altText: text("alt_text").notNull(),
  },
  (table) => [primaryKey({ columns: [table.mediaId, table.locale] })],
);

// ---------------------------------------------------------------------------
// category
// ---------------------------------------------------------------------------

export const category = pgTable("category", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Machine name. Never translated — it is not on the i18n table. */
  key: text("key").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  /**
   * A named icon from one icon set. ANTI_SLOP.md §3 flags this column as a trap:
   * it must never hold an emoji character. Emoji as UI iconography is slop tell
   * #15, and it also breaks the CJK font stack.
   */
  icon: text("icon"),
});

export const categoryI18n = pgTable(
  "category_i18n",
  {
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    name: text("name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.categoryId, table.locale] })],
);

// ---------------------------------------------------------------------------
// resource_pack — the engine. One page per video.
// ---------------------------------------------------------------------------

export const resourcePack = pgTable(
  "resource_pack",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Spoken aloud in a video. Permanent — a rename adds a slug_redirect row. */
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    /** Derived from videoUrl by lib/video-url.ts, never entered by hand. §5a. */
    videoPlatform: videoPlatform("video_platform").notNull().default("other"),
    videoUrl: text("video_url"),
    videoId: text("video_id"),
    repoUrl: text("repo_url"),
    status: contentStatus("status").notNull().default("draft"),
    hasAffiliate: boolean("has_affiliate").notNull().default(false),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("resource_pack_status_published_idx").on(
      table.status,
      table.publishedAt,
    ),
    index("resource_pack_category_idx").on(table.categoryId),
  ],
);

export const resourcePackI18n = pgTable(
  "resource_pack_i18n",
  {
    packId: uuid("pack_id")
      .notNull()
      .references(() => resourcePack.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    notesMd: text("notes_md"),
  },
  (table) => [primaryKey({ columns: [table.packId, table.locale] })],
);

/**
 * CLAUDE.md rule 3: once a slug is published it is permanent. A rename inserts a
 * row here and the old URL keeps resolving forever, because it was spoken aloud
 * in a video that will still be watched in three years.
 */
export const slugRedirect = pgTable("slug_redirect", {
  id: uuid("id").primaryKey().defaultRandom(),
  oldSlug: text("old_slug").notNull().unique(),
  packId: uuid("pack_id")
    .notNull()
    .references(() => resourcePack.id, { onDelete: "cascade" }),
  createdAt: timestamps.createdAt,
});

export const resourceItem = pgTable(
  "resource_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .notNull()
      .references(() => resourcePack.id, { onDelete: "cascade" }),
    kind: itemKind("kind").notNull(),
    url: text("url"),
    mediaId: uuid("media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    /** For kind = 'code' or 'command': the literal body, plus its language. */
    body: text("body"),
    lang: text("lang"),
    sortOrder: integer("sort_order").notNull().default(0),
    isAffiliate: boolean("is_affiliate").notNull().default(false),
  },
  (table) => [index("resource_item_pack_idx").on(table.packId, table.sortOrder)],
);

export const resourceItemI18n = pgTable(
  "resource_item_i18n",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => resourceItem.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    label: text("label").notNull(),
    note: text("note"),
  },
  (table) => [primaryKey({ columns: [table.itemId, table.locale] })],
);

// ---------------------------------------------------------------------------
// repo_entry — the curated library
// ---------------------------------------------------------------------------

export const repoEntry = pgTable(
  "repo_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Never translated. Not on the i18n table, so it structurally cannot be. */
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    githubUrl: text("github_url").notNull(),
    categoryId: uuid("category_id").references(() => category.id, {
      onDelete: "set null",
    }),
    status: repoStatus("status").notNull().default("maintained"),
    supersededByUrl: text("superseded_by_url"),
    stars: integer("stars"),
    licenseSpdx: text("license_spdx"),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    contentStatus: contentStatus("content_status").notNull().default("draft"),
    hasAffiliate: boolean("has_affiliate").notNull().default(false),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => [uniqueIndex("repo_entry_owner_name_idx").on(table.owner, table.name)],
);

/**
 * §3: the last four fields are the whole value of this section. A summary that
 * only restates the README is not worth publishing, so the admin form warns when
 * notForYouIf or theCatch is empty. They are also the fields that make slop copy
 * impossible — "the catch" cannot be written in marketing voice without the
 * sentence falling apart.
 */
export const repoEntryI18n = pgTable(
  "repo_entry_i18n",
  {
    entryId: uuid("entry_id")
      .notNull()
      .references(() => repoEntry.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    oneLiner: text("one_liner").notNull(),
    forWhom: text("for_whom"),
    notForYouIf: text("not_for_you_if"),
    replaces: text("replaces"),
    theCatch: text("the_catch"),
  },
  (table) => [primaryKey({ columns: [table.entryId, table.locale] })],
);

// ---------------------------------------------------------------------------
// post
// ---------------------------------------------------------------------------

export const post = pgTable(
  "post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    status: contentStatus("status").notNull().default("draft"),
    hasAffiliate: boolean("has_affiliate").notNull().default(false),
    coverMediaId: uuid("cover_media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("post_status_published_idx").on(table.status, table.publishedAt)],
);

export const postI18n = pgTable(
  "post_i18n",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    bodyMd: text("body_md"),
  },
  (table) => [primaryKey({ columns: [table.postId, table.locale] })],
);

// ---------------------------------------------------------------------------
// tool
// ---------------------------------------------------------------------------

export const tool = pgTable("tool", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Brand names. Never translated. */
  name: text("name").notNull(),
  vendor: text("vendor"),
  canonicalUrl: text("canonical_url").notNull(),
  affiliateUrl: text("affiliate_url"),
  /** §3: false must render a visible marker. Honest is the whole product. */
  personallyUsed: boolean("personally_used").notNull().default(true),
  categoryId: uuid("category_id").references(() => category.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const toolI18n = pgTable(
  "tool_i18n",
  {
    toolId: uuid("tool_id")
      .notNull()
      .references(() => tool.id, { onDelete: "cascade" }),
    locale: locale("locale").notNull(),
    whyIUseIt: text("why_i_use_it"),
    caveat: text("caveat"),
  },
  (table) => [primaryKey({ columns: [table.toolId, table.locale] })],
);

// ---------------------------------------------------------------------------
// operations
// ---------------------------------------------------------------------------

/** §8: three consecutive failures marks a link. Dead entries are never deleted. */
export const linkHealth = pgTable(
  "link_health",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: targetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    url: text("url").notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    httpStatus: integer("http_status"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  },
  (table) => [
    index("link_health_target_idx").on(table.targetType, table.targetId),
    index("link_health_failures_idx").on(table.consecutiveFailures),
  ],
);

/**
 * §5: attribution comes free. One slug per video means a hit on /r/{slug} already
 * says which video sent the traffic — no UTM tags for Amin to remember mid-record.
 */
export const shortLinkHit = pgTable(
  "short_link_hit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    referrer: text("referrer"),
    locale: text("locale"),
    createdAt: timestamps.createdAt,
  },
  (table) => [index("short_link_hit_slug_created_idx").on(table.slug, table.createdAt)],
);

/** §10: double opt-in. Only a confirmed row is mailable. Phase 3. */
export const subscriber = pgTable("subscriber", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  locale: locale("locale").notNull().default("en"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  /** Which page they signed up from. */
  sourceSlug: text("source_slug"),
  createdAt: timestamps.createdAt,
});

// ---------------------------------------------------------------------------
// relations
// ---------------------------------------------------------------------------

export const resourcePackRelations = relations(resourcePack, ({ one, many }) => ({
  category: one(category, {
    fields: [resourcePack.categoryId],
    references: [category.id],
  }),
  translations: many(resourcePackI18n),
  items: many(resourceItem),
  redirects: many(slugRedirect),
}));

export const resourcePackI18nRelations = relations(resourcePackI18n, ({ one }) => ({
  pack: one(resourcePack, {
    fields: [resourcePackI18n.packId],
    references: [resourcePack.id],
  }),
}));

export const resourceItemRelations = relations(resourceItem, ({ one, many }) => ({
  pack: one(resourcePack, {
    fields: [resourceItem.packId],
    references: [resourcePack.id],
  }),
  translations: many(resourceItemI18n),
}));

export const resourceItemI18nRelations = relations(resourceItemI18n, ({ one }) => ({
  item: one(resourceItem, {
    fields: [resourceItemI18n.itemId],
    references: [resourceItem.id],
  }),
}));

export const slugRedirectRelations = relations(slugRedirect, ({ one }) => ({
  pack: one(resourcePack, {
    fields: [slugRedirect.packId],
    references: [resourcePack.id],
  }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  translations: many(categoryI18n),
  packs: many(resourcePack),
  repos: many(repoEntry),
}));

export const categoryI18nRelations = relations(categoryI18n, ({ one }) => ({
  category: one(category, {
    fields: [categoryI18n.categoryId],
    references: [category.id],
  }),
}));

export const repoEntryRelations = relations(repoEntry, ({ one, many }) => ({
  category: one(category, {
    fields: [repoEntry.categoryId],
    references: [category.id],
  }),
  translations: many(repoEntryI18n),
}));

export const repoEntryI18nRelations = relations(repoEntryI18n, ({ one }) => ({
  entry: one(repoEntry, {
    fields: [repoEntryI18n.entryId],
    references: [repoEntry.id],
  }),
}));

export const postRelations = relations(post, ({ many }) => ({
  translations: many(postI18n),
}));

export const postI18nRelations = relations(postI18n, ({ one }) => ({
  post: one(post, { fields: [postI18n.postId], references: [post.id] }),
}));

export const toolRelations = relations(tool, ({ one, many }) => ({
  category: one(category, {
    fields: [tool.categoryId],
    references: [category.id],
  }),
  translations: many(toolI18n),
}));

export const toolI18nRelations = relations(toolI18n, ({ one }) => ({
  tool: one(tool, { fields: [toolI18n.toolId], references: [tool.id] }),
}));

export const mediaRelations = relations(media, ({ many }) => ({
  translations: many(mediaI18n),
}));

export const mediaI18nRelations = relations(mediaI18n, ({ one }) => ({
  media: one(media, { fields: [mediaI18n.mediaId], references: [media.id] }),
}));
