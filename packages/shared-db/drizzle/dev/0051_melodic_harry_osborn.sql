ALTER TABLE "ugc_scripts" ADD COLUMN "is_silent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "has_character" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "video_type" varchar(50) DEFAULT 'ugc' NOT NULL;