CREATE TYPE "public"."ugc_video_job_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ugc_video_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"script_id" uuid NOT NULL,
	"voice_id" varchar(255) NOT NULL,
	"status" "ugc_video_job_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"scene_videos" jsonb,
	"final_video_key" text,
	"total_duration_seconds" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ugc_video_generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ugc_video_generation_jobs" ADD CONSTRAINT "ugc_video_generation_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_video_generation_jobs" ADD CONSTRAINT "ugc_video_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_team_id_idx" ON "ugc_video_generation_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_script_id_idx" ON "ugc_video_generation_jobs" USING btree ("script_id");--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_status_idx" ON "ugc_video_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_created_at_idx" ON "ugc_video_generation_jobs" USING btree ("created_at");