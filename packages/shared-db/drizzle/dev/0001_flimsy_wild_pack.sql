CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"public" boolean DEFAULT false NOT NULL,
	"gender" varchar(20),
	"age_range" varchar(20),
	"vibe" varchar(50),
	"appearance_config" jsonb,
	"style_config" jsonb,
	"character_images" jsonb NOT NULL,
	"primary_image_index" integer DEFAULT 0 NOT NULL,
	"reference_images" jsonb,
	"generation_prompt" text,
	"parent_character_id" integer,
	"is_variation" boolean DEFAULT false NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "characters_team_id_idx" ON "characters" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "characters_public_idx" ON "characters" USING btree ("public");--> statement-breakpoint
CREATE INDEX "characters_uses_count_idx" ON "characters" USING btree ("uses_count");--> statement-breakpoint
CREATE INDEX "characters_parent_id_idx" ON "characters" USING btree ("parent_character_id");