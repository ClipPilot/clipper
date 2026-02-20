CREATE TYPE "public"."virality_alert_status" AS ENUM('sent', 'failed');--> statement-breakpoint
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
ALTER TABLE "virality_alert_logs" ADD CONSTRAINT "virality_alert_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_alert_logs" ADD CONSTRAINT "virality_alert_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;