ALTER TABLE "virality_alert_logs" ADD COLUMN "alert_posts_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "owned_percent_threshold" integer DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "owned_absolute_threshold" integer DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "owned_threshold_mode" "virality_threshold_mode" DEFAULT 'and' NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "owned_alerts_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "competitor_percent_threshold" integer DEFAULT 150 NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "competitor_absolute_threshold" integer DEFAULT 50000 NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "competitor_threshold_mode" "virality_threshold_mode" DEFAULT 'or' NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ADD COLUMN "competitor_alerts_enabled" boolean DEFAULT true NOT NULL;