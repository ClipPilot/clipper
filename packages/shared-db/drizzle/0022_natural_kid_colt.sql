CREATE TYPE "public"."comfy_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."gpu_pod_status" AS ENUM('idle', 'busy', 'offline');--> statement-breakpoint
CREATE TABLE "comfy_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"status" "comfy_job_status" DEFAULT 'queued' NOT NULL,
	"image_file" text NOT NULL,
	"video_file" text NOT NULL,
	"workflow_json" jsonb NOT NULL,
	"assigned_pod" text,
	"output_file" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "comfy_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD CONSTRAINT "comfy_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comfy_jobs_status_idx" ON "comfy_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "comfy_jobs_team_id_idx" ON "comfy_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "comfy_jobs_created_at_idx" ON "comfy_jobs" USING btree ("created_at");