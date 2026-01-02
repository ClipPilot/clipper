-- Add progress tracking fields to comfy_jobs
ALTER TABLE "comfy_jobs" ADD COLUMN "progress" integer DEFAULT 0;
ALTER TABLE "comfy_jobs" ADD COLUMN "progress_message" text;

-- Make workflow_json optional (worker manages the template now)
ALTER TABLE "comfy_jobs" ALTER COLUMN "workflow_json" DROP NOT NULL;
