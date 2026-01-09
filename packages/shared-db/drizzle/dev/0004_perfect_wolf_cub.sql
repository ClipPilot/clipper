

CREATE TYPE "public"."scene_image_job_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."ugc_script_status" ADD VALUE 'queued' BEFORE 'generating';--> statement-breakpoint
CREATE TABLE "scene_image_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"script_id" uuid NOT NULL,
	"scene_id" varchar(255) NOT NULL,
	"scene_number" integer NOT NULL,
	"character_id" integer,
	"prompt" text NOT NULL,
	"user_refinement" text,
	"supporting_image_keys" jsonb DEFAULT '[]'::jsonb,
	"status" "scene_image_job_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"generated_images" jsonb,
	"selected_image_index" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "scene_image_generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scene_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"script_id" uuid NOT NULL,
	"scene_id" varchar(255) NOT NULL,
	"scene_number" integer NOT NULL,
	"image_key" text NOT NULL,
	"generation_job_id" uuid,
	"prompt_used" text,
	"user_refinement" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ALTER COLUMN "scripts_data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "progress_message" text;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "structure_id" varchar(50);--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "custom_pattern" jsonb;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "target_duration" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "number_of_variations" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "scene_image_generation_jobs" ADD CONSTRAINT "scene_image_generation_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_image_generation_jobs" ADD CONSTRAINT "scene_image_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_image_generation_jobs" ADD CONSTRAINT "scene_image_generation_jobs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scene_image_jobs_team_id_idx" ON "scene_image_generation_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_script_id_idx" ON "scene_image_generation_jobs" USING btree ("script_id");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_scene_id_idx" ON "scene_image_generation_jobs" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_status_idx" ON "scene_image_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_created_at_idx" ON "scene_image_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scene_images_script_id_idx" ON "scene_images" USING btree ("script_id");--> statement-breakpoint
CREATE INDEX "scene_images_scene_id_idx" ON "scene_images" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_images_script_scene_idx" ON "scene_images" USING btree ("script_id","scene_id");