CREATE TABLE "api_wallet_top_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"tokens_added" integer NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_checkout_session_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_wallet_top_ups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ADD COLUMN "balance_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ADD COLUMN "total_spent_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ADD COLUMN "total_topped_up_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_usage_logs" ADD COLUMN "tokens_consumed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_wallet_top_ups" ADD CONSTRAINT "api_wallet_top_ups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_wallet_top_ups_team_id_idx" ON "api_wallet_top_ups" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "api_billing_accounts" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "api_billing_accounts" DROP COLUMN "current_period_start";--> statement-breakpoint
ALTER TABLE "api_billing_accounts" DROP COLUMN "current_period_end";--> statement-breakpoint
ALTER TABLE "api_billing_accounts" DROP COLUMN "total_usage_cents_this_period";--> statement-breakpoint
ALTER TABLE "api_usage_logs" DROP COLUMN "unit_price_cents";--> statement-breakpoint
ALTER TABLE "api_usage_logs" DROP COLUMN "stripe_usage_record_id";