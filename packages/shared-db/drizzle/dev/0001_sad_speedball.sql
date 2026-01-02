ALTER TABLE "comfy_jobs" ALTER COLUMN "workflow_json" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "progress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "progress_message" text;