ALTER TABLE "virality_alert_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "additional_emails" jsonb DEFAULT '[]'::jsonb NOT NULL;