ALTER TABLE "clips" ADD COLUMN "folder_id" integer;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_folder_id_clip_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."clip_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clips_folder_id_idx" ON "clips" USING btree ("folder_id");