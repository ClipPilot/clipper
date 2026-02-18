ALTER TABLE "usage_stats" ALTER COLUMN "limit" SET DEFAULT 15;--> statement-breakpoint
ALTER TABLE "ad_clone_projects" ADD COLUMN "voice_id" varchar(255);