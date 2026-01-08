CREATE TYPE "public"."character_job_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "character_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" character_job_status DEFAULT 'queued' NOT NULL,
	"config" jsonb NOT NULL,
	"parent_character_id" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"generated_images" jsonb,
	"generation_prompt" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "character_generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "character_generation_jobs" ADD CONSTRAINT "character_generation_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_generation_jobs" ADD CONSTRAINT "character_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_generation_jobs_team_id_idx" ON "character_generation_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "character_generation_jobs_status_idx" ON "character_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "character_generation_jobs_created_at_idx" ON "character_generation_jobs" USING btree ("created_at");