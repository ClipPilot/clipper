CREATE TYPE "public"."clip_factory_batch_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "clip_factory_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"videos" jsonb NOT NULL,
	"options" jsonb NOT NULL,
	"loops" integer DEFAULT 1 NOT NULL,
	"current_index" integer DEFAULT 0 NOT NULL,
	"status" "clip_factory_batch_status" DEFAULT 'processing' NOT NULL,
	"current_clip_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_jobs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
