CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_idea_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"exact_description" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"obsidian_filepath" text,
	"obsidian_title" text,
	"completed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "problems" ADD CONSTRAINT "problems_project_idea_id_project_ideas_id_fk" FOREIGN KEY ("project_idea_id") REFERENCES "public"."project_ideas"("id") ON DELETE cascade ON UPDATE no action;