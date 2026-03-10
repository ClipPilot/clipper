CREATE TYPE "public"."cpm_charge_source" AS ENUM('wallet', 'card');--> statement-breakpoint
CREATE TYPE "public"."cpm_charge_status" AS ENUM('charged', 'failed', 'waived');--> statement-breakpoint
CREATE TABLE "campaign_daily_charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"charge_date" timestamp NOT NULL,
	"total_views_delta" integer DEFAULT 0 NOT NULL,
	"cpm_rate" numeric(10, 2) NOT NULL,
	"charge_cents" integer DEFAULT 0 NOT NULL,
	"source" "cpm_charge_source",
	"status" "cpm_charge_status" DEFAULT 'charged' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"failure_reason" text,
	"post_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_daily_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_posts" ADD COLUMN "last_billed_views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_daily_charges" ADD CONSTRAINT "campaign_daily_charges_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_daily_charges" ADD CONSTRAINT "campaign_daily_charges_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cdc_campaign_id_idx" ON "campaign_daily_charges" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "cdc_team_id_idx" ON "campaign_daily_charges" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "cdc_charge_date_idx" ON "campaign_daily_charges" USING btree ("charge_date");--> statement-breakpoint
CREATE INDEX "cdc_campaign_date_idx" ON "campaign_daily_charges" USING btree ("campaign_id","charge_date");