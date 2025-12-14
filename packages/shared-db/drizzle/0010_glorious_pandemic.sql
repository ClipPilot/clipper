ALTER TABLE "clips" ADD COLUMN "blank_video_path" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "srt_path" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "captions_data" jsonb;