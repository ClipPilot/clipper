CREATE TYPE "public"."virality_platform" AS ENUM('instagram');--> statement-breakpoint
CREATE TYPE "public"."virality_sync_status" AS ENUM('pending', 'syncing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "virality_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_id" integer NOT NULL,
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "virality_posts_unique" UNIQUE("target_id","platform_post_id")
);
--> statement-breakpoint
ALTER TABLE "virality_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "virality_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
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
	"is_verified" boolean DEFAULT false,
	"last_synced_at" timestamp,
	"sync_status" "virality_sync_status" DEFAULT 'pending',
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "virality_targets_unique" UNIQUE("team_id","platform","username")
);
--> statement-breakpoint
ALTER TABLE "virality_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "virality_posts" ADD CONSTRAINT "virality_posts_target_id_virality_targets_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."virality_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_targets" ADD CONSTRAINT "virality_targets_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "virality_posts_target_id_idx" ON "virality_posts" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "virality_posts_posted_at_idx" ON "virality_posts" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "virality_targets_team_id_idx" ON "virality_targets" USING btree ("team_id");