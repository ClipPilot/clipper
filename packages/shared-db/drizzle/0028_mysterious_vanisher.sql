CREATE TYPE "public"."character_job_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scene_image_job_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ugc_script_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ugc_video_job_status" AS ENUM('queued', 'generating', 'completed', 'failed');--> statement-breakpoint
ALTER TYPE "public"."comfy_job_status" ADD VALUE 'pending_upload' BEFORE 'queued';--> statement-breakpoint
CREATE TABLE "character_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" character_job_status DEFAULT 'queued' NOT NULL,
	"config" jsonb NOT NULL,
	"parent_character_id" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"generated_images" jsonb,
	"generation_prompt" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "character_generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
CREATE TABLE "saved_faces" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"image_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_faces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
	"end_image_key" text,
	"generation_job_id" uuid,
	"prompt_used" text,
	"user_refinement" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scene_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ugc_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"product_image_keys" jsonb NOT NULL,
	"product_name" varchar(255),
	"script_direction" text,
	"scripts_data" jsonb,
	"selected_variant_index" integer DEFAULT 0 NOT NULL,
	"status" "ugc_script_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"error_message" text,
	"structure_id" varchar(50),
	"custom_pattern" jsonb,
	"target_duration" integer DEFAULT 30,
	"number_of_variations" integer DEFAULT 2,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ugc_scripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ugc_video_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"script_id" uuid NOT NULL,
	"voice_id" varchar(255) NOT NULL,
	"status" "ugc_video_job_status" DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"scene_videos" jsonb,
	"final_video_key" text,
	"total_duration_seconds" real,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ugc_video_generation_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"dashboard_layout" jsonb,
	"widget_colors" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "character_generation_jobs" ADD CONSTRAINT "character_generation_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_generation_jobs" ADD CONSTRAINT "character_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_faces" ADD CONSTRAINT "saved_faces_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_image_generation_jobs" ADD CONSTRAINT "scene_image_generation_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_image_generation_jobs" ADD CONSTRAINT "scene_image_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_image_generation_jobs" ADD CONSTRAINT "scene_image_generation_jobs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD CONSTRAINT "ugc_scripts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_scripts" ADD CONSTRAINT "ugc_scripts_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_video_generation_jobs" ADD CONSTRAINT "ugc_video_generation_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ugc_video_generation_jobs" ADD CONSTRAINT "ugc_video_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "character_generation_jobs_team_id_idx" ON "character_generation_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "character_generation_jobs_status_idx" ON "character_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "character_generation_jobs_created_at_idx" ON "character_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "characters_team_id_idx" ON "characters" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "characters_public_idx" ON "characters" USING btree ("public");--> statement-breakpoint
CREATE INDEX "characters_uses_count_idx" ON "characters" USING btree ("uses_count");--> statement-breakpoint
CREATE INDEX "characters_parent_id_idx" ON "characters" USING btree ("parent_character_id");--> statement-breakpoint
CREATE INDEX "saved_faces_team_id_idx" ON "saved_faces" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_team_id_idx" ON "scene_image_generation_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_script_id_idx" ON "scene_image_generation_jobs" USING btree ("script_id");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_scene_id_idx" ON "scene_image_generation_jobs" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_status_idx" ON "scene_image_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "scene_image_jobs_created_at_idx" ON "scene_image_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "scene_images_script_id_idx" ON "scene_images" USING btree ("script_id");--> statement-breakpoint
CREATE INDEX "scene_images_scene_id_idx" ON "scene_images" USING btree ("scene_id");--> statement-breakpoint
CREATE INDEX "scene_images_script_scene_idx" ON "scene_images" USING btree ("script_id","scene_id");--> statement-breakpoint
CREATE INDEX "ugc_scripts_team_id_idx" ON "ugc_scripts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "ugc_scripts_character_id_idx" ON "ugc_scripts" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "ugc_scripts_status_idx" ON "ugc_scripts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ugc_scripts_created_at_idx" ON "ugc_scripts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_team_id_idx" ON "ugc_video_generation_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_script_id_idx" ON "ugc_video_generation_jobs" USING btree ("script_id");--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_status_idx" ON "ugc_video_generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ugc_video_jobs_created_at_idx" ON "ugc_video_generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clips_title_trgm_idx" ON "clips" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "clips_message_trgm_idx" ON "clips" USING gin ("message" gin_trgm_ops);