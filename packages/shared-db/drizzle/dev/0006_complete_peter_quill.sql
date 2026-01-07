CREATE TYPE "public"."affiliate_status" AS ENUM('pending', 'active', 'churned');--> statement-breakpoint
CREATE TABLE "affiliate_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"commission_percent" numeric(5, 2) DEFAULT '10' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "affiliate_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_id" integer NOT NULL,
	"invoice_id" varchar(255) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"commission_percent" numeric(5, 2) NOT NULL,
	"payout_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_user_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"payout_date" timestamp,
	"stripe_transfer_id" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_code_id" integer NOT NULL,
	"referred_team_id" integer NOT NULL,
	"referred_plan" varchar(50),
	"status" "affiliate_status" DEFAULT 'pending' NOT NULL,
	"commission_earned" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payout_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "affiliates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_affiliate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliate_codes" ADD CONSTRAINT "affiliate_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_payout_id_affiliate_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."affiliate_payouts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_user_id_users_id_fk" FOREIGN KEY ("affiliate_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_affiliate_code_id_affiliate_codes_id_fk" FOREIGN KEY ("affiliate_code_id") REFERENCES "public"."affiliate_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_referred_team_id_teams_id_fk" FOREIGN KEY ("referred_team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliate_codes_user_id_idx" ON "affiliate_codes" USING btree ("created_by_user_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_affiliate_id_idx" ON "affiliate_commissions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_payout_id_idx" ON "affiliate_commissions" USING btree ("payout_id");--> statement-breakpoint
CREATE INDEX "affiliate_payouts_user_id_idx" ON "affiliate_payouts" USING btree ("affiliate_user_id");--> statement-breakpoint
CREATE INDEX "affiliates_code_id_idx" ON "affiliates" USING btree ("affiliate_code_id");--> statement-breakpoint
CREATE INDEX "affiliates_team_id_idx" ON "affiliates" USING btree ("referred_team_id");