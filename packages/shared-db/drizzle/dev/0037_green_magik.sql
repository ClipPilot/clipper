ALTER TABLE "virality_accounts" ADD COLUMN "syncs_remaining" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_accounts" DROP COLUMN "last_credit_charged_at";