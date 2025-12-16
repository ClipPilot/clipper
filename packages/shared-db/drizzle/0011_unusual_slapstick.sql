ALTER TABLE "subscriptions" ADD COLUMN "plan" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "plan" varchar(50) DEFAULT 'free' NOT NULL;