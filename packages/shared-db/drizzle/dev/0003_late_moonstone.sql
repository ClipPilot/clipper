CREATE TYPE "public"."ugc_script_status" AS ENUM('generating', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ugc_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"product_image_keys" jsonb NOT NULL,
	"product_name" varchar(255),
	"script_direction" text,
	"scripts_data" jsonb NOT NULL,
	"selected_variant_index" integer DEFAULT 0 NOT NULL,
	"status" "ugc_script_status" DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ugc_scripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD CONSTRAINT "ugc_scripts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD CONSTRAINT "ugc_scripts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ugc_scripts_team_id_idx" ON "ugc_scripts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "ugc_scripts_character_id_idx" ON "ugc_scripts" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "ugc_scripts_status_idx" ON "ugc_scripts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ugc_scripts_created_at_idx" ON "ugc_scripts" USING btree ("created_at");