CREATE TYPE "public"."cron_run_status" AS ENUM('running', 'success', 'error');--> statement-breakpoint
CREATE TYPE "public"."cron_run_trigger" AS ENUM('scheduled', 'manual', 'retry');--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" varchar(64) NOT NULL,
	"status" "cron_run_status" DEFAULT 'running' NOT NULL,
	"triggered_by" "cron_run_trigger" DEFAULT 'scheduled' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"result" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "cron_runs_job_started_idx" ON "cron_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "cron_runs_started_idx" ON "cron_runs" USING btree ("started_at");