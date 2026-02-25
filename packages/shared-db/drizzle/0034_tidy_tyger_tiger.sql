CREATE TYPE "public"."virality_alert_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."virality_threshold_mode" AS ENUM('and', 'or');--> statement-breakpoint
CREATE TABLE "virality_alert_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"email_body" text NOT NULL,
	"viral_post_ids" jsonb NOT NULL,
	"status" "virality_alert_status" NOT NULL,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "virality_alert_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "virality_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"percent_threshold" integer,
	"absolute_threshold" integer,
	"threshold_mode" "virality_threshold_mode" DEFAULT 'or' NOT NULL,
	"time_frame_hours" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "virality_settings_team_unique" UNIQUE("team_id")
);
--> statement-breakpoint
ALTER TABLE "virality_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD COLUMN "quoted_cpm" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD COLUMN "budget" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD COLUMN "video_minimum" integer;--> statement-breakpoint
ALTER TABLE "uploaded_raw_videos" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD COLUMN "account_type" varchar(20) DEFAULT 'profile' NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD COLUMN "alert_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD COLUMN "syncs_remaining" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_alert_logs" ADD CONSTRAINT "virality_alert_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_alert_logs" ADD CONSTRAINT "virality_alert_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD CONSTRAINT "virality_settings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_raw_videos" ADD CONSTRAINT "uploaded_raw_videos_public_id_unique" UNIQUE("public_id");