CREATE TABLE "clip_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"clip_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clip_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(50) DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clip_folders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clips" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "uploaded_raw_videos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "usage_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "clip_tags" ADD CONSTRAINT "clip_tags_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_tags" ADD CONSTRAINT "clip_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_tags_clip_id_idx" ON "clip_tags" USING btree ("clip_id");--> statement-breakpoint
CREATE INDEX "clip_tags_tag_id_idx" ON "clip_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "clip_tags_clip_id_tag_id_idx" ON "clip_tags" USING btree ("clip_id","tag_id");--> statement-breakpoint
CREATE INDEX "tags_team_id_idx" ON "tags" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "tags_team_id_name_idx" ON "tags" USING btree ("team_id","name");