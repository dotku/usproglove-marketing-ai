CREATE TYPE "public"."ai_task" AS ENUM('score', 'draft', 'research', 'extract');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('outbound', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."message_kind" AS ENUM('first_touch', 'follow_up_1', 'follow_up_2', 'reply', 'handoff');--> statement-breakpoint
CREATE TYPE "public"."prospect_status" AS ENUM('discovered', 'enriching', 'enriched', 'ready', 'sending', 'sent', 'replied', 'bounced', 'suppressed', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."usage_snapshot_kind" AS ENUM('db_total_size_bytes', 'table_row_count', 'table_size_bytes', 'brevo_daily_remaining', 'brevo_credits_remaining', 'hunter_searches_remaining', 'hunter_verifications_remaining', 'snov_credits_remaining', 'ai_daily_cost_usd', 'blob_size_bytes');--> statement-breakpoint
CREATE TYPE "public"."vertical" AS ENUM('tattoo', 'beauty', 'restaurant', 'medical', 'industrial', 'automotive', 'agriculture', 'janitorial', 'cannabis', 'veterinary');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" "ai_task" NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"reasoning_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer NOT NULL,
	"campaign_id" uuid,
	"prospect_id" uuid,
	"message_id" uuid,
	"errored" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vertical" "vertical" NOT NULL,
	"hero_sku_id" varchar(32) NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"daily_cap" integer DEFAULT 10 NOT NULL,
	"contacts_per_company" integer DEFAULT 3 NOT NULL,
	"icp" jsonb,
	"prompt_template" text NOT NULL,
	"sender_email" text NOT NULL,
	"sender_name" text NOT NULL,
	"reply_to_email" text NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"phone" text,
	"address_line" text,
	"city" text,
	"region" varchar(32),
	"country_code" varchar(2) DEFAULT 'US',
	"vertical" "vertical" NOT NULL,
	"sub_vertical" varchar(64),
	"google_place_id" text,
	"rating" integer,
	"review_count" integer,
	"discovery_source_id" varchar(32) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_google_place_id_unique" UNIQUE("google_place_id")
);
--> statement-breakpoint
CREATE TABLE "content_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(128) NOT NULL,
	"vertical" "vertical" NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"body_mdx" text NOT NULL,
	"hero_sku_id" varchar(32),
	"keywords" jsonb,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_pieces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"campaign_id" uuid,
	"kind" varchar(64) NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"campaign_id" uuid,
	"direction" "message_direction" NOT NULL,
	"kind" "message_kind" NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"message_id" text,
	"in_reply_to" text,
	"provider_message_id" text,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"bounced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" text,
	"status" "prospect_status" DEFAULT 'discovered' NOT NULL,
	"score" integer,
	"enrichment_source_id" varchar(32),
	"enrichment_confidence" integer,
	"suppressed_at" timestamp with time zone,
	"suppression_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"reason" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppressions_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usage_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "usage_snapshot_kind" NOT NULL,
	"scope" varchar(128),
	"value" numeric(20, 6) NOT NULL,
	"unit" varchar(16) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_task_idx" ON "ai_usage" USING btree ("task");--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_campaign_idx" ON "ai_usage" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "companies_vertical_idx" ON "companies" USING btree ("vertical");--> statement-breakpoint
CREATE INDEX "companies_region_idx" ON "companies" USING btree ("region");--> statement-breakpoint
CREATE INDEX "events_kind_idx" ON "events" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "messages_prospect_idx" ON "messages" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "messages_in_reply_to_idx" ON "messages" USING btree ("in_reply_to");--> statement-breakpoint
CREATE INDEX "prospects_email_idx" ON "prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "prospects_status_idx" ON "prospects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "usage_snapshots_kind_idx" ON "usage_snapshots" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "usage_snapshots_created_idx" ON "usage_snapshots" USING btree ("created_at");