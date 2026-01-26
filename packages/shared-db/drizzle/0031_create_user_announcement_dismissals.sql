CREATE TABLE "user_announcement_dismissals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"announcement_id" integer NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_announcement_dismissals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_announcement_dismissals" ADD CONSTRAINT "user_announcement_dismissals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_announcement_dismissals" ADD CONSTRAINT "user_announcement_dismissals_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_announcement_unique" ON "user_announcement_dismissals" USING btree ("user_id","announcement_id");--> statement-breakpoint
CREATE INDEX "user_announcement_dismissals_user_id_idx" ON "user_announcement_dismissals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_announcement_dismissals_announcement_id_idx" ON "user_announcement_dismissals" USING btree ("announcement_id");
