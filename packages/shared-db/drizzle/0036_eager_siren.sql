CREATE TYPE "public"."campaign_contract_status" AS ENUM('pending', 'signed', 'voided');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('pending', 'accepted', 'rejected', 'appeal', 'started', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('investigating', 'identified', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TABLE "campaign_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"team_id" integer NOT NULL,
	"signed_by_user_id" integer,
	"is_master" boolean DEFAULT false NOT NULL,
	"terms" jsonb,
	"unsigned_pdf_key" text,
	"signed_pdf_key" text,
	"signature_image_key" text,
	"signer_legal_name" varchar(255),
	"signer_legal_entity_name" varchar(255),
	"signer_title" varchar(255),
	"signer_email" varchar(255),
	"signer_ip_address" varchar(45),
	"effective_date" timestamp,
	"signed_at" timestamp,
	"status" "campaign_contract_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_contracts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaign_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"clip_id" integer,
	"custom_video_key" text,
	"custom_video_name" varchar(255),
	"duration_seconds" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_videos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaign_wallet_top_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_wallet_top_ups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaign_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"total_deposited_cents" integer DEFAULT 0 NOT NULL,
	"total_spent_cents" integer DEFAULT 0 NOT NULL,
	"stripe_payment_method_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_wallets_campaign_id_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_wallets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"intake_form_id" integer,
	"name" varchar(255) NOT NULL,
	"status" "campaign_status" DEFAULT 'pending' NOT NULL,
	"quoted_cpm" numeric(10, 2),
	"budget" numeric(12, 2),
	"video_minimum" integer,
	"minimum_fund" numeric(12, 2),
	"rejection_reason" text,
	"admin_notes" text,
	"google_drive_folder_id" varchar(255),
	"videos_ready" boolean DEFAULT false NOT NULL,
	"payment_ready" boolean DEFAULT false NOT NULL,
	"contract_ready" boolean DEFAULT false NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"status" "incident_status" DEFAULT 'investigating' NOT NULL,
	"affected_services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_admin_email" varchar(255) NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"platform" "virality_platform" NOT NULL,
	"account_type" varchar(20) DEFAULT 'profile' NOT NULL,
	"username" varchar(255) NOT NULL,
	"profile_url" text NOT NULL,
	"display_name" varchar(255),
	"avatar_url" text,
	"bio" text,
	"follower_count" integer,
	"following_count" integer,
	"total_likes" integer,
	"post_count" integer,
	"follower_history" jsonb,
	"is_verified" boolean DEFAULT false,
	"last_synced_at" timestamp,
	"sync_status" "virality_sync_status" DEFAULT 'pending',
	"sync_error" text,
	"alert_enabled" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"syncs_remaining" integer DEFAULT 14 NOT NULL,
	"source" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_accounts_unique" UNIQUE("team_id","platform","username")
);
--> statement-breakpoint
ALTER TABLE "user_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"platform_post_id" varchar(255) NOT NULL,
	"post_url" text NOT NULL,
	"thumbnail_url" text,
	"caption" text,
	"hashtags" jsonb,
	"post_type" varchar(50),
	"posted_at" timestamp,
	"like_count" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"video_view_count" integer,
	"video_play_count" integer,
	"metrics_history" jsonb DEFAULT '[]'::jsonb,
	"mass_post_id" integer,
	"syncs_remaining" integer DEFAULT 28 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_posts_unique" UNIQUE("account_id","platform_post_id")
);
--> statement-breakpoint
ALTER TABLE "user_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "mass_posting_applications" CASCADE;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "percent_threshold" SET DEFAULT 100;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "percent_threshold" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "absolute_threshold" SET DEFAULT 100000;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "absolute_threshold" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_settings" ALTER COLUMN "threshold_mode" SET DEFAULT 'and';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "campaign_id" integer;--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD CONSTRAINT "campaign_contracts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD CONSTRAINT "campaign_contracts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_contracts" ADD CONSTRAINT "campaign_contracts_signed_by_user_id_users_id_fk" FOREIGN KEY ("signed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_videos" ADD CONSTRAINT "campaign_videos_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_videos" ADD CONSTRAINT "campaign_videos_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_wallet_top_ups" ADD CONSTRAINT "campaign_wallet_top_ups_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_wallet_top_ups" ADD CONSTRAINT "campaign_wallet_top_ups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_wallets" ADD CONSTRAINT "campaign_wallets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_wallets" ADD CONSTRAINT "campaign_wallets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_intake_form_id_intake_forms_id_fk" FOREIGN KEY ("intake_form_id") REFERENCES "public"."intake_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_posts" ADD CONSTRAINT "user_posts_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_posts" ADD CONSTRAINT "user_posts_mass_post_id_posts_id_fk" FOREIGN KEY ("mass_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_contracts_campaign_id_idx" ON "campaign_contracts" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_contracts_team_id_idx" ON "campaign_contracts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "campaign_videos_campaign_id_idx" ON "campaign_videos" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_videos_clip_id_idx" ON "campaign_videos" USING btree ("clip_id");--> statement-breakpoint
CREATE INDEX "campaign_wallet_top_ups_campaign_id_idx" ON "campaign_wallet_top_ups" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_wallet_top_ups_team_id_idx" ON "campaign_wallet_top_ups" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "campaign_wallets_campaign_id_idx" ON "campaign_wallets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_wallets_team_id_idx" ON "campaign_wallets" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "campaigns_team_id_idx" ON "campaigns" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_team_id_status_idx" ON "campaigns" USING btree ("team_id","status");--> statement-breakpoint
CREATE INDEX "user_accounts_team_id_idx" ON "user_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "user_posts_account_id_idx" ON "user_posts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "user_posts_posted_at_idx" ON "user_posts" USING btree ("posted_at");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_campaign_id_idx" ON "posts" USING btree ("campaign_id");--> statement-breakpoint
DROP TYPE "public"."mass_posting_status";