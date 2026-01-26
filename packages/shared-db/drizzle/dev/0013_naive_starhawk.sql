CREATE TYPE "public"."ad_clone_project_status" AS ENUM('uploading', 'analyzing', 'analysis_complete', 'generating_script', 'script_generated', 'generating_video', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ad_clone_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"reference_video_key" text,
	"product_image_keys" jsonb NOT NULL,
	"product_name" varchar(255),
	"product_description" text,
	"ad_direction" text,
	"gemini_file_name" text,
	"gemini_file_uri" text,
	"video_analysis" jsonb,
	"adapted_scripts" jsonb,
	"selected_variant_index" integer DEFAULT 0 NOT NULL,
	"character_id" integer,
	"status" "ad_clone_project_status" DEFAULT 'uploading' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_message" text,
	"error_message" text,
	"final_video_key" text,
	"video_job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_clone_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ad_clone_projects" ADD CONSTRAINT "ad_clone_projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_clone_projects" ADD CONSTRAINT "ad_clone_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_clone_projects" ADD CONSTRAINT "ad_clone_projects_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_clone_projects_team_id_idx" ON "ad_clone_projects" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "ad_clone_projects_user_id_idx" ON "ad_clone_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ad_clone_projects_status_idx" ON "ad_clone_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ad_clone_projects_created_at_idx" ON "ad_clone_projects" USING btree ("created_at");