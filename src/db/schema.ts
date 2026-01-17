import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const projectIdeas = pgTable("project_ideas", {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    exactDescription: text("exact_description").notNull(),
    tags: text("tags").array().notNull().default([]),
    obsidianFilepath: text("obsidian_filepath"),
    obsidianTitle: text("obsidian_title"),
    slug: text("slug").unique(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});

// Problems belong to started projects only (foreign key enforces relationship)
// A problem has its own lifecycle: created -> initialized -> started -> completed
// Problems can have subproblems forming a recursive hierarchy (adjacency list pattern)
export const problems = pgTable("problems", {
    id: uuid("id").defaultRandom().primaryKey(),
    projectIdeaId: uuid("project_idea_id")
        .notNull()
        .references(() => projectIdeas.id, { onDelete: "cascade" }),
    // Self-referential foreign key for hierarchical subproblems
    // null = root problem, non-null = subproblem of parent
    parentProblemId: uuid("parent_problem_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    // Unique slug for folder naming, set when initialized
    // This slug is also used as the worktree name when initializing via worktree
    slug: text("slug").unique(),
    // Optional: path to the worktree where this atom was initialized
    worktreePath: text("worktree_path"),
    // initializedAt being non-null means the atom route has been set up
    initializedAt: timestamp("initialized_at", { withTimezone: true }),
    // startedAt being non-null means work has begun
    startedAt: timestamp("started_at", { withTimezone: true }),
    // reviewedAt being non-null means work is ready for review (can only be set if startedAt is set)
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    // completedAt being non-null means problem is resolved (can only be set if reviewedAt is set)
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Optional custom prompt for this problem (can contain @file references)
    prompt: text("prompt"),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
