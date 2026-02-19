CREATE TYPE "public"."gender_enum" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."mass_posting_status" AS ENUM('pending', 'accepted', 'rejected', 'appeal');--> statement-breakpoint
CREATE TYPE "public"."platform_enum" AS ENUM('tiktok', 'instagram', 'facebook', 'youtube', 'x');--> statement-breakpoint
CREATE TYPE "public"."post_status_enum" AS ENUM('scheduled', 'posted', 'cancelled', 'deleted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."virality_platform" AS ENUM('instagram', 'tiktok', 'x');--> statement-breakpoint
CREATE TYPE "public"."virality_sync_status" AS ENUM('pending', 'syncing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_billing_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"balance_cents" integer DEFAULT 0 NOT NULL,
	"total_spent_cents" integer DEFAULT 0 NOT NULL,
	"total_topped_up_cents" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"auto_refill" boolean DEFAULT false NOT NULL,
	"refill_threshold_cents" integer DEFAULT 500 NOT NULL,
	"refill_amount_cents" integer DEFAULT 2500 NOT NULL,
	"stripe_payment_method_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_billing_accounts_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"api_key_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"product_slug" varchar(100),
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"response_time_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_usage_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "api_wallet_top_ups" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"credits_cents" integer NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_checkout_session_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_wallet_top_ups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cloned_voices" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"voice_id" varchar(255) NOT NULL,
	"sample_audio_key" text NOT NULL,
	"gender" "gender_enum" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cloned_voices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "intake_forms" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"brand_description" text,
	"company_website_url" varchar(2048),
	"icps" jsonb,
	"company_socials" jsonb,
	"competitor_socials" jsonb,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "intake_forms_team_id_unique" UNIQUE("team_id")
);
--> statement-breakpoint
ALTER TABLE "intake_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mass_posting_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"intake_form_id" integer,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"details" jsonb,
	"google_drive_folder_id" varchar(255),
	"rejection_reason" text,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"clip_id" integer,
	"content" text NOT NULL,
	"platform" "platform_enum" NOT NULL,
	"posted_time" timestamp DEFAULT now() NOT NULL,
	"post_url" text,
	"drive_file_id" varchar(255),
	"status" "post_status_enum" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "virality_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"competitor_id" integer,
	"platform" "virality_platform" NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "virality_accounts_unique" UNIQUE("team_id","platform","username")
);
--> statement-breakpoint
ALTER TABLE "virality_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "virality_competitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "virality_competitors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "virality_posts" (
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "virality_posts_unique" UNIQUE("account_id","platform_post_id")
);
--> statement-breakpoint
ALTER TABLE "virality_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_stats" ALTER COLUMN "limit" SET DEFAULT 15;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_billing_accounts" ADD CONSTRAINT "api_billing_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_logs" ADD CONSTRAINT "api_usage_logs_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_wallet_top_ups" ADD CONSTRAINT "api_wallet_top_ups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloned_voices" ADD CONSTRAINT "cloned_voices_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_forms" ADD CONSTRAINT "intake_forms_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD CONSTRAINT "mass_posting_applications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD CONSTRAINT "mass_posting_applications_intake_form_id_intake_forms_id_fk" FOREIGN KEY ("intake_form_id") REFERENCES "public"."intake_forms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD CONSTRAINT "virality_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD CONSTRAINT "virality_accounts_competitor_id_virality_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."virality_competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_competitors" ADD CONSTRAINT "virality_competitors_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_posts" ADD CONSTRAINT "virality_posts_account_id_virality_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."virality_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_team_id_idx" ON "api_keys" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_billing_accounts_team_id_idx" ON "api_billing_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "api_usage_logs_api_key_id_idx" ON "api_usage_logs" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "api_usage_logs_team_id_idx" ON "api_usage_logs" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "api_usage_logs_created_at_idx" ON "api_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_usage_logs_product_slug_idx" ON "api_usage_logs" USING btree ("product_slug");--> statement-breakpoint
CREATE INDEX "api_wallet_top_ups_team_id_idx" ON "api_wallet_top_ups" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "intake_forms_team_id_idx" ON "intake_forms" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "mass_posting_applications_team_id_idx" ON "mass_posting_applications" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "posts_team_id_idx" ON "posts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "posts_platform_idx" ON "posts" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "posts_clip_id_idx" ON "posts" USING btree ("clip_id");--> statement-breakpoint
CREATE INDEX "virality_accounts_team_id_idx" ON "virality_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "virality_competitors_team_id_idx" ON "virality_competitors" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "virality_posts_account_id_idx" ON "virality_posts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "virality_posts_posted_at_idx" ON "virality_posts" USING btree ("posted_at");