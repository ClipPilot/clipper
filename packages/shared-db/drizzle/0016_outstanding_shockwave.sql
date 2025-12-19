ALTER TABLE "clip_folders" ADD COLUMN "parent_folder_id" integer;--> statement-breakpoint
CREATE INDEX "clip_folders_parent_folder_id_idx" ON "clip_folders" USING btree ("parent_folder_id");