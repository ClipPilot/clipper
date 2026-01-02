ALTER TABLE "comfy_jobs" ALTER COLUMN "workflow_json" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "parent_job_id" uuid;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "sequence_number" integer;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "total_chunks" integer;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "chunk_start_time" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "chunk_end_time" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "job_type" text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "original_video_s3_key" text;--> statement-breakpoint
CREATE INDEX "comfy_jobs_parent_job_id_idx" ON "comfy_jobs" USING btree ("parent_job_id");--> statement-breakpoint
CREATE INDEX "comfy_jobs_priority_created_at_idx" ON "comfy_jobs" USING btree ("priority","created_at");