ALTER TYPE "public"."virality_platform" ADD VALUE 'tiktok';--> statement-breakpoint
ALTER TYPE "public"."virality_platform" ADD VALUE 'x';--> statement-breakpoint
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
ALTER TABLE "virality_posts" ADD COLUMN "metrics_history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "virality_targets" ADD COLUMN "competitor_id" integer;--> statement-breakpoint
ALTER TABLE "virality_competitors" ADD CONSTRAINT "virality_competitors_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "virality_competitors_team_id_idx" ON "virality_competitors" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "virality_targets" ADD CONSTRAINT "virality_targets_competitor_id_virality_competitors_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."virality_competitors"("id") ON DELETE cascade ON UPDATE no action;