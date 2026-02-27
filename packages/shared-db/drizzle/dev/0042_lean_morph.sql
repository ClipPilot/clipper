ALTER TABLE "user_accounts" ADD COLUMN "source" varchar(20);--> statement-breakpoint
ALTER TABLE "user_posts" ADD COLUMN "mass_post_id" integer;--> statement-breakpoint
ALTER TABLE "user_posts" ADD COLUMN "syncs_remaining" integer DEFAULT 28 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_posts" ADD CONSTRAINT "user_posts_mass_post_id_posts_id_fk" FOREIGN KEY ("mass_post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;