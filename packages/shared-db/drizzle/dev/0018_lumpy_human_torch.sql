DO $$ BEGIN
  CREATE TYPE "public"."mass_posting_status" AS ENUM('pending', 'accepted', 'rejected', 'appeal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intake_forms" (
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
CREATE TABLE IF NOT EXISTS "mass_posting_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "intake_forms" ADD CONSTRAINT "intake_forms_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mass_posting_applications" ADD CONSTRAINT "mass_posting_applications_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intake_forms_team_id_idx" ON "intake_forms" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mass_posting_applications_team_id_idx" ON "mass_posting_applications" USING btree ("team_id");