CREATE TYPE "public"."virality_threshold_mode" AS ENUM('and', 'or');--> statement-breakpoint
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
ALTER TABLE "virality_accounts" ADD COLUMN "alert_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD CONSTRAINT "virality_settings_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;