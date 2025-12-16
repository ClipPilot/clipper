ALTER TABLE "clips" ADD COLUMN "watermarked_clip_path" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "saved" boolean DEFAULT false NOT NULL;