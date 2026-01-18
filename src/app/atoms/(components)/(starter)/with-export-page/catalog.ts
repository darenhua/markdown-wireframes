import { createCatalog } from "@json-render/core";
import { z } from "zod";

/**
 * This catalog defines the ONLY components that the AI can generate.
 * It acts as a guardrail ensuring the AI outputs predictable, safe UI.
 */
export const catalog = createCatalog({
  components: {
    // Layout
    Card: {
      props: z.object({
        title: z.string().nullable(),
      }),
      hasChildren: true,
    },
    Stack: {
      props: z.object({
        direction: z.enum(["horizontal", "vertical"]).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      hasChildren: true,
    },
    Grid: {
      props: z.object({
        columns: z.number().min(1).max(4).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      hasChildren: true,
    },

    // Typography
    Heading: {
      props: z.object({
        text: z.string(),
        level: z.enum(["1", "2", "3"]).nullable(),
      }),
    },
    Text: {
      props: z.object({
        text: z.string(),
        variant: z.enum(["default", "muted", "error", "success"]).nullable(),
      }),
    },

    // Data Display
    Metric: {
      props: z.object({
        label: z.string(),
        value: z.string(),
        change: z.string().nullable(),
        trend: z.enum(["up", "down", "neutral"]).nullable(),
      }),
    },
    Badge: {
      props: z.object({
        text: z.string(),
        variant: z
          .enum(["default", "success", "warning", "error", "info"])
          .nullable(),
      }),
    },
    List: {
      props: z.object({
        items: z.array(z.string()),
        ordered: z.boolean().nullable(),
      }),
    },

    // Interactive
    Button: {
      props: z.object({
        label: z.string(),
        variant: z.enum(["default", "primary", "secondary", "ghost"]).nullable(),
      }),
    },
    Input: {
      props: z.object({
        label: z.string().nullable(),
        placeholder: z.string().nullable(),
        type: z.enum(["text", "email", "password", "number"]).nullable(),
      }),
    },

    // Feedback
    Alert: {
      props: z.object({
        message: z.string(),
        variant: z.enum(["info", "success", "warning", "error"]).nullable(),
      }),
    },

    // Utility
    Divider: {
      props: z.object({}),
    },
    Empty: {
      props: z.object({
        message: z.string().nullable(),
      }),
    },
  },
  actions: {},
});

// Export the catalog schema for use in the API route
export const catalogSchema = catalog.schema;
