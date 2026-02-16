ALTER TABLE "api_billing_accounts" ADD COLUMN "auto_refill" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ADD COLUMN "refill_threshold_cents" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ADD COLUMN "refill_amount_cents" integer DEFAULT 2500 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ADD COLUMN "stripe_payment_method_id" varchar(255);