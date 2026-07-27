CREATE TYPE "public"."content_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."item_kind" AS ENUM('code', 'file', 'link', 'command');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'ms', 'zh-Hans');--> statement-breakpoint
CREATE TYPE "public"."repo_status" AS ENUM('maintained', 'slowing', 'archived', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."target_type" AS ENUM('resource_pack', 'resource_item', 'repo_entry', 'post', 'tool');--> statement-breakpoint
CREATE TYPE "public"."video_platform" AS ENUM('youtube', 'tiktok', 'instagram', 'other');--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"icon" text,
	CONSTRAINT "category_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "category_i18n" (
	"category_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "category_i18n_category_id_locale_pk" PRIMARY KEY("category_id","locale")
);
--> statement-breakpoint
CREATE TABLE "link_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" "target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"url" text NOT NULL,
	"last_checked_at" timestamp with time zone,
	"http_status" integer,
	"consecutive_failures" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"r2_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"blurhash" text,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_r2_key_unique" UNIQUE("r2_key")
);
--> statement-breakpoint
CREATE TABLE "media_i18n" (
	"media_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"alt_text" text NOT NULL,
	CONSTRAINT "media_i18n_media_id_locale_pk" PRIMARY KEY("media_id","locale")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"has_affiliate" boolean DEFAULT false NOT NULL,
	"cover_media_id" uuid,
	"published_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "post_i18n" (
	"post_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"body_md" text,
	CONSTRAINT "post_i18n_post_id_locale_pk" PRIMARY KEY("post_id","locale")
);
--> statement-breakpoint
CREATE TABLE "repo_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"github_url" text NOT NULL,
	"category_id" uuid,
	"status" "repo_status" DEFAULT 'maintained' NOT NULL,
	"superseded_by_url" text,
	"stars" integer,
	"license_spdx" text,
	"last_commit_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"content_status" "content_status" DEFAULT 'draft' NOT NULL,
	"has_affiliate" boolean DEFAULT false NOT NULL,
	"cover_media_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_entry_i18n" (
	"entry_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"one_liner" text NOT NULL,
	"for_whom" text,
	"not_for_you_if" text,
	"replaces" text,
	"the_catch" text,
	CONSTRAINT "repo_entry_i18n_entry_id_locale_pk" PRIMARY KEY("entry_id","locale")
);
--> statement-breakpoint
CREATE TABLE "resource_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"kind" "item_kind" NOT NULL,
	"url" text,
	"media_id" uuid,
	"body" text,
	"lang" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_affiliate" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_item_i18n" (
	"item_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"label" text NOT NULL,
	"note" text,
	CONSTRAINT "resource_item_i18n_item_id_locale_pk" PRIMARY KEY("item_id","locale")
);
--> statement-breakpoint
CREATE TABLE "resource_pack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"category_id" uuid,
	"video_platform" "video_platform" DEFAULT 'other' NOT NULL,
	"video_url" text,
	"video_id" text,
	"repo_url" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"has_affiliate" boolean DEFAULT false NOT NULL,
	"cover_media_id" uuid,
	"published_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_pack_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "resource_pack_i18n" (
	"pack_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"notes_md" text,
	CONSTRAINT "resource_pack_i18n_pack_id_locale_pk" PRIMARY KEY("pack_id","locale")
);
--> statement-breakpoint
CREATE TABLE "short_link_hit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"referrer" text,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_redirect" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_slug" text NOT NULL,
	"pack_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slug_redirect_old_slug_unique" UNIQUE("old_slug")
);
--> statement-breakpoint
CREATE TABLE "subscriber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"locale" "locale" DEFAULT 'en' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"source_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriber_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tool" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vendor" text,
	"canonical_url" text NOT NULL,
	"affiliate_url" text,
	"personally_used" boolean DEFAULT true NOT NULL,
	"category_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_i18n" (
	"tool_id" uuid NOT NULL,
	"locale" "locale" NOT NULL,
	"why_i_use_it" text,
	"caveat" text,
	CONSTRAINT "tool_i18n_tool_id_locale_pk" PRIMARY KEY("tool_id","locale")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"github_login" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category_i18n" ADD CONSTRAINT "category_i18n_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_i18n" ADD CONSTRAINT "media_i18n_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_i18n" ADD CONSTRAINT "post_i18n_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_entry" ADD CONSTRAINT "repo_entry_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_entry" ADD CONSTRAINT "repo_entry_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_entry_i18n" ADD CONSTRAINT "repo_entry_i18n_entry_id_repo_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."repo_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_item" ADD CONSTRAINT "resource_item_pack_id_resource_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."resource_pack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_item" ADD CONSTRAINT "resource_item_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_item_i18n" ADD CONSTRAINT "resource_item_i18n_item_id_resource_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."resource_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pack" ADD CONSTRAINT "resource_pack_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pack" ADD CONSTRAINT "resource_pack_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_pack_i18n" ADD CONSTRAINT "resource_pack_i18n_pack_id_resource_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."resource_pack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_redirect" ADD CONSTRAINT "slug_redirect_pack_id_resource_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."resource_pack"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool" ADD CONSTRAINT "tool_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_i18n" ADD CONSTRAINT "tool_i18n_tool_id_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_health_target_idx" ON "link_health" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "link_health_failures_idx" ON "link_health" USING btree ("consecutive_failures");--> statement-breakpoint
CREATE INDEX "post_status_published_idx" ON "post" USING btree ("status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_entry_owner_name_idx" ON "repo_entry" USING btree ("owner","name");--> statement-breakpoint
CREATE INDEX "resource_item_pack_idx" ON "resource_item" USING btree ("pack_id","sort_order");--> statement-breakpoint
CREATE INDEX "resource_pack_status_published_idx" ON "resource_pack" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "resource_pack_category_idx" ON "resource_pack" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "short_link_hit_slug_created_idx" ON "short_link_hit" USING btree ("slug","created_at");