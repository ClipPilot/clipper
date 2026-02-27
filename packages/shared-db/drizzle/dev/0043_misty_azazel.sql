ALTER TABLE "virality_settings" ALTER COLUMN "percent_threshold" SET DEFAULT 100;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "percent_threshold" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "absolute_threshold" SET DEFAULT 100000;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "absolute_threshold" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "threshold_mode" SET DEFAULT 'and';