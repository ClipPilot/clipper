ALTER TABLE "clip_factory_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ugc_scripts" DROP CONSTRAINT "ugc_scripts_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "ugc_scripts" ALTER COLUMN "character_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "is_silent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "has_character" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "video_type" varchar(50) DEFAULT 'ugc' NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD CONSTRAINT "ugc_scripts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;