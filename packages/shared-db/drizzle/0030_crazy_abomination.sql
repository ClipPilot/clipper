CREATE TYPE "public"."announcement_priority" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."announcement_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"priority" "announcement_priority" DEFAULT 'info' NOT NULL,
	"status" "announcement_status" DEFAULT 'draft' NOT NULL,
	"icon" varchar(100),
	"action_label" varchar(50),
	"action_url" text,
	"created_by_admin_email" varchar(255) NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_announcement_dismissals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"announcement_id" integer NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_announcement_unique" UNIQUE("user_id","announcement_id")
);
--> statement-breakpoint
ALTER TABLE "user_announcement_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_announcement_dismissals" ADD CONSTRAINT "user_announcement_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_announcement_dismissals" ADD CONSTRAINT "user_announcement_dismissals_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_status_idx" ON "announcements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "announcements_published_at_idx" ON "announcements" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "user_announcement_dismissals_user_id_idx" ON "user_announcement_dismissals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_announcement_dismissals_announcement_id_idx" ON "user_announcement_dismissals" USING btree ("announcement_id");