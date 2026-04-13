ALTER TABLE "virality_competitors" RENAME TO "virality_groups";--> statement-breakpoint
ALTER TABLE "virality_accounts" DROP CONSTRAINT "virality_accounts_competitor_id_virality_competitors_id_fk";
--> statement-breakpoint
ALTER TABLE "virality_groups" DROP CONSTRAINT "virality_competitors_team_id_teams_id_fk";
--> statement-breakpoint
DROP INDEX "virality_competitors_team_id_idx";--> statement-breakpoint
ALTER TABLE "virality_groups" ADD COLUMN "competitor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "virality_accounts" ADD CONSTRAINT "virality_accounts_competitor_id_virality_groups_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."virality_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virality_groups" ADD CONSTRAINT "virality_groups_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "virality_groups_team_id_idx" ON "virality_groups" USING btree ("team_id");