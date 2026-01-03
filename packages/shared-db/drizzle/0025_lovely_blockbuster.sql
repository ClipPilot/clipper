CREATE TYPE "public"."referral_status" AS ENUM('pending', 'active', 'churned');--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"created_by_team_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "referral_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referral_code_id" integer NOT NULL,
	"referred_team_id" integer NOT NULL,
	"referred_plan" varchar(50),
	"status" "referral_status" DEFAULT 'pending' NOT NULL,
	"percent_off" numeric(5, 2) DEFAULT '0' NOT NULL,
	"bonus_clips" integer DEFAULT 0 NOT NULL,
	"reward_applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "enterprise_clip_limit" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "enterprise_monthly_price" integer;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_created_by_team_id_teams_id_fk" FOREIGN KEY ("created_by_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_team_id_teams_id_fk" FOREIGN KEY ("referred_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;