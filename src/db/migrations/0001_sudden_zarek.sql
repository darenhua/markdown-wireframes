ALTER TABLE "problems" ADD COLUMN "parent_problem_id" uuid;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "worktree_slug" text;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "initialized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "problems" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_ideas" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "project_ideas" ADD CONSTRAINT "project_ideas_slug_unique" UNIQUE("slug");