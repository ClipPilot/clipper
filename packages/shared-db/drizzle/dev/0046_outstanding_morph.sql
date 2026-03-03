ALTER TABLE "campaign_contracts" ALTER COLUMN "campaign_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD COLUMN "is_master" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD COLUMN "signer_legal_entity_name" varchar(255);--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD COLUMN "signer_title" varchar(255);--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD COLUMN "signer_email" varchar(255);--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD COLUMN "effective_date" timestamp;