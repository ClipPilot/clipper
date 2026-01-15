CREATE TABLE "saved_faces" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"image_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_faces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_faces" ADD CONSTRAINT "saved_faces_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_faces_team_id_idx" ON "saved_faces" USING btree ("team_id");