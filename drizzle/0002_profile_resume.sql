ALTER TABLE "users" ADD COLUMN "resume" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_type" text DEFAULT 'personal' NOT NULL;