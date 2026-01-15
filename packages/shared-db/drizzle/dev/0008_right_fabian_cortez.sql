CREATE INDEX "clips_title_trgm_idx" ON "clips" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "clips_message_trgm_idx" ON "clips" USING gin ("message" gin_trgm_ops);