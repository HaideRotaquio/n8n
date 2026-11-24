CREATE TYPE "public"."catalog_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."checkout_status" AS ENUM('open', 'completed', 'expired', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('paid', 'partially_refunded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('lemonsqueezy', 'paddle', 'test');--> statement-breakpoint
CREATE TYPE "public"."product_kind" AS ENUM('single', 'pack');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'rejected', 'submitted', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "checkout_session" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"product_id" text NOT NULL,
	"price_id" text NOT NULL,
	"license_type" text NOT NULL,
	"currency" char(3) NOT NULL,
	"amount_cents" integer NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_checkout_id" text,
	"url" text,
	"status" "checkout_status" DEFAULT 'open' NOT NULL,
	"test_mode" boolean NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_brand_slug_unique" UNIQUE("brand_id","slug"),
	CONSTRAINT "collection_slug_format" CHECK ("collection"."slug" ~ '^[a-z0-9-]{2,80}$')
);
--> statement-breakpoint
CREATE TABLE "collection_product" (
	"collection_id" text NOT NULL,
	"product_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_product_collection_id_product_id_pk" PRIMARY KEY("collection_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "download" (
	"id" text PRIMARY KEY NOT NULL,
	"entitlement_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"asset_version" integer NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entitlement" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"product_id" text NOT NULL,
	"license_id" text,
	"source" text NOT NULL,
	"granted_by" text,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "license" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"brand_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	"product_id" text NOT NULL,
	"license_type" text NOT NULL,
	"terms_version" text NOT NULL,
	"licensee_name" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	CONSTRAINT "license_code_unique" UNIQUE("code"),
	CONSTRAINT "license_order_item_id_unique" UNIQUE("order_item_id")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"checkout_session_id" text,
	"provider" "payment_provider" NOT NULL,
	"provider_order_id" text NOT NULL,
	"status" "order_status" DEFAULT 'paid' NOT NULL,
	"currency" char(3) NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"fee_cents" integer,
	"refunded_cents" integer DEFAULT 0 NOT NULL,
	"email" text,
	"test_mode" boolean NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_provider_unique" UNIQUE("provider","provider_order_id")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"price_id" text,
	"license_type" text NOT NULL,
	"title_snapshot" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"license_type" text NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"amount_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_product_license_currency_unique" UNIQUE("product_id","license_type","currency"),
	CONSTRAINT "price_amount_range" CHECK ("price"."amount_cents" >= 0 AND "price"."amount_cents" <= 10000000),
	CONSTRAINT "price_currency_format" CHECK ("price"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" text PRIMARY KEY NOT NULL,
	"brand_id" text NOT NULL,
	"slug" text NOT NULL,
	"kind" "product_kind" NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" "catalog_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_brand_slug_unique" UNIQUE("brand_id","slug"),
	CONSTRAINT "product_slug_format" CHECK ("product"."slug" ~ '^[a-z0-9-]{2,80}$')
);
--> statement-breakpoint
CREATE TABLE "product_asset" (
	"product_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_asset_product_id_asset_id_pk" PRIMARY KEY("product_id","asset_id")
);
--> statement-breakpoint
CREATE TABLE "refund_request" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"brand_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"requested_by" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"provider_refund_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refund_amount_positive" CHECK ("refund_request"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"outcome" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "webhook_event_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
ALTER TABLE "checkout_session" ADD CONSTRAINT "checkout_session_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_session" ADD CONSTRAINT "checkout_session_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_session" ADD CONSTRAINT "checkout_session_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_session" ADD CONSTRAINT "checkout_session_price_id_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."price"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_entitlement_id_entitlement_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download" ADD CONSTRAINT "download_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_license_id_license_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."license"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlement" ADD CONSTRAINT "entitlement_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_order_item_id_order_item_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license" ADD CONSTRAINT "license_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_checkout_session_id_checkout_session_id_fk" FOREIGN KEY ("checkout_session_id") REFERENCES "public"."checkout_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_price_id_price_id_fk" FOREIGN KEY ("price_id") REFERENCES "public"."price"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price" ADD CONSTRAINT "price_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_asset" ADD CONSTRAINT "product_asset_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_asset" ADD CONSTRAINT "product_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_brand_id_brand_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_customer_idx" ON "checkout_session" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "download_customer_time_idx" ON "download" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "entitlement_customer_idx" ON "entitlement" USING btree ("customer_id","product_id");--> statement-breakpoint
CREATE INDEX "license_customer_idx" ON "license" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "license_brand_idx" ON "license" USING btree ("brand_id","issued_at");--> statement-breakpoint
CREATE INDEX "order_brand_time_idx" ON "order" USING btree ("brand_id","paid_at");--> statement-breakpoint
CREATE INDEX "order_customer_idx" ON "order" USING btree ("customer_id","paid_at");--> statement-breakpoint
CREATE INDEX "order_item_order_idx" ON "order_item" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "product_brand_status_idx" ON "product" USING btree ("brand_id","status","published_at");--> statement-breakpoint
CREATE INDEX "product_asset_asset_idx" ON "product_asset" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "refund_request_status_idx" ON "refund_request" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "webhook_event_time_idx" ON "webhook_event" USING btree ("received_at");