ALTER TABLE "mass_posting_applications" ADD COLUMN "intake_form_id" integer;--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD COLUMN "google_drive_folder_id" varchar(255);--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD COLUMN "admin_notes" text;--> statement-breakpoint
ALTER TABLE "mass_posting_applications" ADD CONSTRAINT "mass_posting_applications_intake_form_id_intake_forms_id_fk" FOREIGN KEY ("intake_form_id") REFERENCES "public"."intake_forms"("id") ON DELETE set null ON UPDATE no action;