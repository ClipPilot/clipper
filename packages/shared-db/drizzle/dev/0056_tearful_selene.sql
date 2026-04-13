ALTER TABLE "virality_accounts" RENAME TO "competitor_accounts";--> statement-breakpoint
ALTER TABLE "virality_posts" RENAME TO "competitor_posts";--> statement-breakpoint
ALTER TABLE "competitor_accounts" RENAME COLUMN "competitor_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "competitor_accounts" DROP CONSTRAINT "virality_accounts_unique";--> statement-breakpoint
ALTER TABLE "competitor_posts" DROP CONSTRAINT "virality_posts_unique";--> statement-breakpoint
ALTER TABLE "competitor_accounts" DROP CONSTRAINT "virality_accounts_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "competitor_accounts" DROP CONSTRAINT "virality_accounts_competitor_id_virality_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "competitor_posts" DROP CONSTRAINT "virality_posts_account_id_virality_accounts_id_fk";
--> statement-breakpoint
DROP INDEX "virality_accounts_team_id_idx";--> statement-breakpoint
DROP INDEX "virality_posts_account_id_idx";--> statement-breakpoint
DROP INDEX "virality_posts_posted_at_idx";--> statement-breakpoint
ALTER TABLE "user_accounts" ADD COLUMN "group_id" integer;--> statement-breakpoint
ALTER TABLE "user_accounts" ADD CONSTRAINT "user_accounts_group_id_virality_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."virality_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_accounts" ADD CONSTRAINT "competitor_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_accounts" ADD CONSTRAINT "competitor_accounts_group_id_virality_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."virality_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_posts" ADD CONSTRAINT "competitor_posts_account_id_competitor_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."competitor_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitor_accounts_team_id_idx" ON "competitor_accounts" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "competitor_posts_account_id_idx" ON "competitor_posts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "competitor_posts_posted_at_idx" ON "competitor_posts" USING btree ("posted_at");--> statement-breakpoint
ALTER TABLE "competitor_accounts" ADD CONSTRAINT "competitor_accounts_unique" UNIQUE("team_id","platform","username");--> statement-breakpoint
ALTER TABLE "competitor_posts" ADD CONSTRAINT "competitor_posts_unique" UNIQUE("account_id","platform_post_id");