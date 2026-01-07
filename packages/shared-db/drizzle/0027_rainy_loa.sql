CREATE TYPE "public"."affiliate_status" AS ENUM('pending', 'active', 'churned');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_affiliate" boolean DEFAULT false NOT NULL;