ALTER TABLE "comfy_jobs" ADD COLUMN "splice_mode" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD COLUMN "splice_metadata" jsonb;