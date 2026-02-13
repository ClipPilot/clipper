CREATE TYPE "public"."platform_enum" AS ENUM('tiktok', 'instagram', 'facebook', 'youtube', 'x');--> statement-breakpoint
CREATE TYPE "public"."post_status_enum" AS ENUM('scheduled', 'posted', 'cancelled', 'deleted', 'failed');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"content" text NOT NULL,
	"platform" "platform_enum" NOT NULL,
	"posted_time" timestamp NOT NULL,
	"post_url" text,
	"status" "post_status_enum" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_team_id_idx" ON "posts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "posts_platform_idx" ON "posts" USING btree ("platform");