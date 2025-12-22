ALTER TABLE "clips" ADD COLUMN "share_token" varchar(64);--> statement-breakpoint
CREATE INDEX "clips_share_token_idx" ON "clips" USING btree ("share_token");--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_share_token_unique" UNIQUE("share_token");