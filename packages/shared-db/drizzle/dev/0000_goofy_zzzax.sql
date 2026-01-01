CREATE TYPE "public"."clip_status" AS ENUM('pending', 'completed', 'failed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."comfy_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."gpu_pod_status" AS ENUM('idle', 'busy', 'offline');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('owner', 'member', 'manager');--> statement-breakpoint
CREATE TYPE "public"."team_type" AS ENUM('personal', 'business', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "clip_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"parent_folder_id" integer,
	"name" varchar(255) NOT NULL,
	"color" varchar(50),
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clip_folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clip_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"clip_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clip_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "clips" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"generated_by_user_id" integer NOT NULL,
	"folder_id" integer,
	"clip_path" text,
	"blank_video_path" text,
	"watermarked_clip_path" text,
	"srt_path" text,
	"captions_data" jsonb,
	"clip_score" integer,
	"source_video_path" text,
	"clip_metadata" jsonb,
	"input_metadata" jsonb,
	"prompt" text,
	"raw_video_id" integer,
	"title" varchar(255),
	"message" text,
	"status" "clip_status" DEFAULT 'pending' NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"share_token" varchar(64),
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clips_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "clips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comfy_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" integer NOT NULL,
	"status" "comfy_job_status" DEFAULT 'queued' NOT NULL,
	"image_file" text NOT NULL,
	"video_file" text NOT NULL,
	"workflow_json" jsonb NOT NULL,
	"assigned_pod" text,
	"output_file" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "comfy_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"plan" varchar(50) NOT NULL,
	"price_id" varchar(255) NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(50) DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"token" varchar(255) NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "team_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "team_type" DEFAULT 'personal' NOT NULL,
	"team_subscription_id" varchar(255),
	"stripe_customer_id" varchar(255),
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"addon_clips_remaining" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "uploaded_raw_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"video_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "uploaded_raw_videos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "usage_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"clips_created" integer DEFAULT 0 NOT NULL,
	"limit" integer DEFAULT 3 NOT NULL,
	"resets_date" timestamp NOT NULL,
	"rollover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"supabase_uid" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_supabase_uid_unique" UNIQUE("supabase_uid")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clip_folders" ADD CONSTRAINT "clip_folders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_tags" ADD CONSTRAINT "clip_tags_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_tags" ADD CONSTRAINT "clip_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_folder_id_clip_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."clip_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_raw_video_id_uploaded_raw_videos_id_fk" FOREIGN KEY ("raw_video_id") REFERENCES "public"."uploaded_raw_videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comfy_jobs" ADD CONSTRAINT "comfy_jobs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_raw_videos" ADD CONSTRAINT "uploaded_raw_videos_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_stats" ADD CONSTRAINT "usage_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_folders_team_id_idx" ON "clip_folders" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "clip_folders_parent_folder_id_idx" ON "clip_folders" USING btree ("parent_folder_id");--> statement-breakpoint
CREATE INDEX "clip_tags_clip_id_idx" ON "clip_tags" USING btree ("clip_id");--> statement-breakpoint
CREATE INDEX "clip_tags_tag_id_idx" ON "clip_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "clip_tags_clip_id_tag_id_idx" ON "clip_tags" USING btree ("clip_id","tag_id");--> statement-breakpoint
CREATE INDEX "clips_team_id_idx" ON "clips" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "clips_generated_by_user_id_idx" ON "clips" USING btree ("generated_by_user_id");--> statement-breakpoint
CREATE INDEX "clips_folder_id_idx" ON "clips" USING btree ("folder_id");--> statement-breakpoint
CREATE INDEX "clips_share_token_idx" ON "clips" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "comfy_jobs_status_idx" ON "comfy_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "comfy_jobs_team_id_idx" ON "comfy_jobs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "comfy_jobs_created_at_idx" ON "comfy_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tags_team_id_idx" ON "tags" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tags_team_id_name_idx" ON "tags" USING btree ("team_id","name");--> statement-breakpoint
CREATE INDEX "team_invites_email_idx" ON "team_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "team_invites_token_idx" ON "team_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_invites_team_id_idx" ON "team_invites" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "uploaded_raw_videos_team_id_idx" ON "uploaded_raw_videos" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "usage_stats_team_id_date_idx" ON "usage_stats" USING btree ("team_id","date");