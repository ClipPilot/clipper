ALTER TABLE "api_billing_accounts" RENAME COLUMN "balance_tokens" TO "balance_cents";--> statement-breakpoint
ALTER TABLE "api_billing_accounts" RENAME COLUMN "total_spent_tokens" TO "total_spent_cents";--> statement-breakpoint
ALTER TABLE "api_billing_accounts" RENAME COLUMN "total_topped_up_tokens" TO "total_topped_up_cents";--> statement-breakpoint
ALTER TABLE "api_usage_logs" RENAME COLUMN "tokens_consumed" TO "cost_cents";--> statement-breakpoint
ALTER TABLE "api_wallet_top_ups" RENAME COLUMN "tokens_added" TO "credits_cents";