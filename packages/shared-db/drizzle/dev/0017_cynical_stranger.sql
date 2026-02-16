ALTER TABLE "virality_targets" RENAME TO "virality_accounts";--> statement-breakpoint
ALTER TABLE "virality_posts" RENAME COLUMN "target_id" TO "account_id";--> statement-breakpoint
ALTER TABLE "virality_posts" DROP CONSTRAINT "virality_posts_unique";--> statement-breakpoint
ALTER TABLE "virality_accounts" DROP CONSTRAINT "virality_targets_unique";--> statement-breakpoint
ALTER TABLE "virality_posts" DROP CONSTRAINT "virality_posts_target_id_virality_targets_id_fk";
--> statement-breakpoint
ALTER TABLE "virality_accounts" DROP CONSTRAINT "virality_targets_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "virality_accounts" DROP CONSTRAINT "virality_targets_competitor_id_virality_competitors_id_fk";
--> statement-breakpoint
DROP INDEX "virality_posts_target_id_idx";--> statement-breakpoint
DROP INDEX "virality_targets_team_id_idx";--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD COLUMN IF NOT EXISTS "follower_history" jsonb;--> statement-breakpoint
ALTER TABLE "virality_posts" ADD CONSTRAINT "virality_posts_account_id_virality_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."virality_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD CONSTRAINT "virality_accounts_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD CONSTRAINT "virality_accounts_competitor_id_virality_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."virality_competitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "virality_posts_account_id_idx" ON "virality_posts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "virality_accounts_team_id_idx" ON "virality_accounts" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "virality_posts" ADD CONSTRAINT "virality_posts_unique" UNIQUE("account_id","platform_post_id");--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD CONSTRAINT "virality_accounts_unique" UNIQUE("team_id","platform","username");