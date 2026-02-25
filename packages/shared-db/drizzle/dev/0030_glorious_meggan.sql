ALTER TABLE "posts" ADD COLUMN "account_handle" varchar(255);--> statement-breakpoint
CREATE INDEX "posts_account_handle_idx" ON "posts" USING btree ("account_handle");