CREATE TABLE "clip_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"color" varchar(50),
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"generated_by_user_id" integer NOT NULL,
	"clip_path" text NOT NULL,
	"clip_score" integer,
	"source_video_path" text NOT NULL,
	"clip_metadata" jsonb NOT NULL,
	"input_metadata" jsonb,
	"prompt" text,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clip_folders" ADD CONSTRAINT "clip_folders_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_folders_team_id_idx" ON "clip_folders" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "clips_team_id_idx" ON "clips" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "clips_generated_by_user_id_idx" ON "clips" USING btree ("generated_by_user_id");