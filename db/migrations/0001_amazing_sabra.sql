CREATE TYPE "public"."repo_change_kind" AS ENUM('status', 'license', 'missing');--> statement-breakpoint
CREATE TABLE "repo_sync_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"kind" "repo_change_kind" NOT NULL,
	"old_value" text,
	"new_value" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "repo_sync_change" ADD CONSTRAINT "repo_sync_change_entry_id_repo_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."repo_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "repo_sync_change_open_idx" ON "repo_sync_change" USING btree ("acknowledged_at","detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "link_health_target_url_idx" ON "link_health" USING btree ("target_type","target_id","url");