CREATE TYPE "public"."sound_source" AS ENUM('recorded', 'library', 'synthesized', 'ai');--> statement-breakpoint
ALTER TYPE "public"."job_kind" ADD VALUE 'catalog';--> statement-breakpoint
CREATE TABLE "sound_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text,
	"name" text NOT NULL,
	"source" "sound_source" NOT NULL,
	"author" text NOT NULL,
	"license_ref" text NOT NULL,
	"license_notes" text DEFAULT '' NOT NULL,
	"rights_confirmed_by" text,
	"storage_key" text NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"sample_rate" integer NOT NULL,
	"loudness_lufs" numeric(6, 2),
	"peak_dbfs" numeric(6, 2),
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sound_license_present" CHECK (length("sound_asset"."license_ref") >= 3)
);
--> statement-breakpoint
ALTER TABLE "sound_asset" ADD CONSTRAINT "sound_asset_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_asset" ADD CONSTRAINT "sound_asset_rights_confirmed_by_user_id_fk" FOREIGN KEY ("rights_confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sound_asset_brand_idx" ON "sound_asset" USING btree ("brand_id","created_at");