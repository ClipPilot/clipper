ALTER TABLE "ugc_scripts" DROP CONSTRAINT "ugc_scripts_character_id_characters_id_fk";
--> statement-breakpoint
ALTER TABLE "ugc_scripts" ALTER COLUMN "character_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD CONSTRAINT "ugc_scripts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;