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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_posts_unique" UNIQUE("account_id","platform_post_id")
);
--> statement-breakpoint
ALTER TABLE "user_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_posts" ADD CONSTRAINT "user_posts_account_id_user_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."user_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_accounts_team_id_idx" ON "user_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "user_posts_account_id_idx" ON "user_posts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "user_posts_posted_at_idx" ON "user_posts" USING btree ("posted_at");