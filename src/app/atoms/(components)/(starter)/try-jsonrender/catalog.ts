import { createCatalog } from "@json-render/core";
import { z } from "zod";

/**
 * This catalog defines the ONLY components that the AI can generate.
 * Maps to shadcn/ui components for consistent, polished styling.
 */
export const catalog = createCatalog({
  components: {
    // ─────────────────────────────────────────────────────────────
    // LAYOUT
    // ─────────────────────────────────────────────────────────────
    Card: {
      props: z.object({
        title: z.string().nullable(),
        description: z.string().nullable(),
      }),
      hasChildren: true,
    },
    Stack: {
      props: z.object({
        direction: z.enum(["horizontal", "vertical"]).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
        align: z.enum(["start", "center", "end", "stretch"]).nullable(),
      }),
      hasChildren: true,
    },
    Grid: {
      props: z.object({
        columns: z.number().min(1).max(6).nullable(),
        gap: z.enum(["sm", "md", "lg"]).nullable(),
      }),
      hasChildren: true,
    },
    Box: {
      props: z.object({
        padding: z.enum(["none", "sm", "md", "lg", "xl"]).nullable(),
        rounded: z.enum(["none", "sm", "md", "lg", "xl", "full"]).nullable(),
        border: z.boolean().nullable(),
        shadow: z.enum(["none", "sm", "md", "lg"]).nullable(),
        align: z.enum(["left", "center", "right"]).nullable(),
      }),
      hasChildren: true,
    },

    // ─────────────────────────────────────────────────────────────
    // TYPOGRAPHY
    // ─────────────────────────────────────────────────────────────
    Heading: {
      props: z.object({
        text: z.string(),
        level: z.enum(["1", "2", "3", "4"]).nullable(),
      }),
    },
    Text: {
      props: z.object({
        text: z.string(),
        variant: z.enum(["default", "muted", "error", "success"]).nullable(),
        size: z.enum(["sm", "base", "lg"]).nullable(),
      }),
    },
    Label: {
      props: z.object({
        text: z.string(),
        htmlFor: z.string().nullable(),
      }),
    },

    // ─────────────────────────────────────────────────────────────
    // DATA DISPLAY
    // ─────────────────────────────────────────────────────────────
    Icon: {
      props: z.object({
        name: z.enum([
          "heart",
          "star",
          "sparkles",
          "gift",
          "party",
          "cake",
          "trophy",
          "rocket",
          "check",
          "check-circle",
          "x",
          "arrow-right",
          "arrow-left",
          "plus",
          "minus",
          "info",
          "warning",
          "zap",
          "smile",
          "thumbs-up",
        ]),
        size: z.enum(["sm", "md", "lg", "xl"]).nullable(),
      }),
    },
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
          .enum(["default", "secondary", "destructive", "outline"])
          .nullable(),
      }),
    },
    Avatar: {
      props: z.object({
        src: z.string().nullable(),
        fallback: z.string(),
        alt: z.string().nullable(),
      }),
    },
    List: {
      props: z.object({
        items: z.array(z.string()),
        ordered: z.boolean().nullable(),
      }),
    },

    // ─────────────────────────────────────────────────────────────
    // INTERACTIVE / FORM
    // ─────────────────────────────────────────────────────────────
    Button: {
      props: z.object({
        label: z.string(),
        variant: z
          .enum(["default", "destructive", "outline", "secondary", "ghost", "link"])
          .nullable(),
        size: z.enum(["default", "sm", "lg", "icon"]).nullable(),
      }),
    },
    Input: {
      props: z.object({
        label: z.string().nullable(),
        placeholder: z.string().nullable(),
        type: z
          .enum(["text", "email", "password", "number", "search", "tel", "url"])
          .nullable(),
      }),
    },
    Textarea: {
      props: z.object({
        label: z.string().nullable(),
        placeholder: z.string().nullable(),
        rows: z.number().min(2).max(10).nullable(),
      }),
    },
    Checkbox: {
      props: z.object({
        label: z.string(),
        checked: z.boolean().nullable(),
      }),
    },

    // ─────────────────────────────────────────────────────────────
    // TABS
    // ─────────────────────────────────────────────────────────────
    Tabs: {
      props: z.object({
        defaultValue: z.string(),
      }),
      hasChildren: true,
    },
    TabsList: {
      props: z.object({}),
      hasChildren: true,
    },
    TabsTrigger: {
      props: z.object({
        value: z.string(),
        label: z.string(),
      }),
    },
    TabsContent: {
      props: z.object({
        value: z.string(),
      }),
      hasChildren: true,
    },

    // ─────────────────────────────────────────────────────────────
    // FEEDBACK
    // ─────────────────────────────────────────────────────────────
    Alert: {
      props: z.object({
        title: z.string().nullable(),
        message: z.string(),
        variant: z.enum(["default", "destructive"]).nullable(),
      }),
    },

    // ─────────────────────────────────────────────────────────────
    // UTILITY
    // ─────────────────────────────────────────────────────────────
    Separator: {
      props: z.object({
        orientation: z.enum(["horizontal", "vertical"]).nullable(),
      }),
    },
    Empty: {
      props: z.object({
        message: z.string().nullable(),
        icon: z.enum(["inbox", "search", "file", "user"]).nullable(),
      }),
    },
  },
  actions: {},
});

// Export the catalog schema for use in the API route
export const catalogSchema = catalog.schema;
