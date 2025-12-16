CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TABLE "team_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"invited_by_user_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"token" varchar(255) NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_invites_email_idx" ON "team_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "team_invites_token_idx" ON "team_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "team_invites_team_id_idx" ON "team_invites" USING btree ("team_id");