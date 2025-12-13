CREATE TABLE "uploaded_raw_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"video_path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "raw_video_id" integer;--> statement-breakpoint
ALTER TABLE "uploaded_raw_videos" ADD CONSTRAINT "uploaded_raw_videos_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploaded_raw_videos_team_id_idx" ON "uploaded_raw_videos" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_raw_video_id_uploaded_raw_videos_id_fk" FOREIGN KEY ("raw_video_id") REFERENCES "public"."uploaded_raw_videos"("id") ON DELETE set null ON UPDATE no action;