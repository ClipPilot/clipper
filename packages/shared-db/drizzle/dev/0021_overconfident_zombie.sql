ALTER TABLE "posts" ALTER COLUMN "posted_time" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "clip_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "drive_file_id" varchar(255);--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_clip_id_idx" ON "posts" USING btree ("clip_id");