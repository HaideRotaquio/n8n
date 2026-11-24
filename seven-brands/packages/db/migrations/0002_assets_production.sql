CREATE TYPE "public"."asset_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('ai', 'infrastructure', 'payments', 'marketing', 'software', 'legal', 'other');--> statement-breakpoint
CREATE TYPE "public"."job_kind" AS ENUM('rig', 'ai', 'export');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."review_kind" AS ENUM('automated', 'human');--> statement-breakpoint
CREATE TABLE "agent_task" (
	"id" text PRIMARY KEY NOT NULL,
	"production_job_id" text NOT NULL,
	"agent" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" "asset_status" DEFAULT 'draft' NOT NULL,
	"category" text,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_brand_slug_unique" UNIQUE("brand_id","slug")
);
--> statement-breakpoint
CREATE TABLE "asset_version" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_id" text NOT NULL,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"provenance" text NOT NULL,
	"production_job_id" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_version_unique" UNIQUE("asset_id","version")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"amount_usd" numeric(12, 6) NOT NULL,
	"source" text NOT NULL,
	"incurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_non_negative" CHECK ("expense"."amount_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "export_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_version_id" text NOT NULL,
	"format" text NOT NULL,
	"storage_key" text NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_artifact_unique" UNIQUE("asset_version_id","format")
);
--> statement-breakpoint
CREATE TABLE "production_job" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"kind" "job_kind" NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"brief" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"requested_by" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_review" (
	"id" text PRIMARY KEY NOT NULL,
	"asset_version_id" text NOT NULL,
	"kind" "review_kind" NOT NULL,
	"score" integer,
	"passed" boolean,
	"decision" text,
	"checks" jsonb,
	"notes" text,
	"reviewer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decision_values" CHECK ("quality_review"."decision" IS NULL OR "quality_review"."decision" IN ('approved','rejected'))
);
--> statement-breakpoint
ALTER TABLE "agent_task" ADD CONSTRAINT "agent_task_production_job_id_production_job_id_fk" FOREIGN KEY ("production_job_id") REFERENCES "public"."production_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_version" ADD CONSTRAINT "asset_version_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_version" ADD CONSTRAINT "asset_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_artifact" ADD CONSTRAINT "export_artifact_asset_version_id_asset_version_id_fk" FOREIGN KEY ("asset_version_id") REFERENCES "public"."asset_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_job" ADD CONSTRAINT "production_job_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_job" ADD CONSTRAINT "production_job_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_review" ADD CONSTRAINT "quality_review_asset_version_id_asset_version_id_fk" FOREIGN KEY ("asset_version_id") REFERENCES "public"."asset_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quality_review" ADD CONSTRAINT "quality_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_task_job_idx" ON "agent_task" USING btree ("production_job_id");--> statement-breakpoint
CREATE INDEX "agent_task_time_idx" ON "agent_task" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "asset_brand_status_idx" ON "asset" USING btree ("brand_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "expense_time_idx" ON "expense" USING btree ("incurred_at");--> statement-breakpoint
CREATE INDEX "expense_brand_idx" ON "expense" USING btree ("brand_id","incurred_at");--> statement-breakpoint
CREATE INDEX "production_job_queue_idx" ON "production_job" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "production_job_brand_idx" ON "production_job" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "quality_review_version_idx" ON "quality_review" USING btree ("asset_version_id","created_at");