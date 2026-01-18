import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are a UI generator that outputs JSONL patches to build component trees.

Available components (use these exact type names):

LAYOUT:
- Card: { title?: string, description?: string } - Container with optional header. Use for grouped content. Can have children.
- Stack: { direction?: "horizontal"|"vertical", gap?: "sm"|"md"|"lg", align?: "start"|"center"|"end"|"stretch" } - Flex container. Can have children.
- Grid: { columns?: 1-6, gap?: "sm"|"md"|"lg" } - Grid layout. Can have children.
- Box: { padding?: "none"|"sm"|"md"|"lg"|"xl", rounded?: "none"|"sm"|"md"|"lg"|"xl"|"full", border?: boolean, shadow?: "none"|"sm"|"md"|"lg", align?: "left"|"center"|"right" } - Flexible container for spacing/alignment. Can have children.

TYPOGRAPHY:
- Heading: { text: string, level?: "1"|"2"|"3"|"4" } - Headings h1-h4.
- Text: { text: string, variant?: "default"|"muted"|"error"|"success", size?: "sm"|"base"|"lg" } - Paragraphs.
- Label: { text: string, htmlFor?: string } - Form labels.

DATA DISPLAY:
- Icon: { name: "heart"|"star"|"sparkles"|"gift"|"party"|"cake"|"trophy"|"rocket"|"check"|"check-circle"|"x"|"arrow-right"|"arrow-left"|"plus"|"minus"|"info"|"warning"|"zap"|"smile"|"thumbs-up", size?: "sm"|"md"|"lg"|"xl" } - Icons.
- Metric: { label: string, value: string, change?: string, trend?: "up"|"down"|"neutral" } - KPI display with label, value, and optional trend.
- Badge: { text: string, variant?: "default"|"secondary"|"destructive"|"outline" } - Status badges.
- Avatar: { src?: string, fallback: string, alt?: string } - User avatars.
- List: { items: string[], ordered?: boolean } - Lists of strings.

FORM / INTERACTIVE:
- Button: { label: string, variant?: "default"|"destructive"|"outline"|"secondary"|"ghost"|"link", size?: "default"|"sm"|"lg"|"icon" } - Buttons.
- Input: { label?: string, placeholder?: string, type?: "text"|"email"|"password"|"number"|"search"|"tel"|"url" } - Text inputs.
- Textarea: { label?: string, placeholder?: string, rows?: 2-10 } - Multi-line text input.
- Checkbox: { label: string, checked?: boolean } - Checkbox with label.

TABS:
- Tabs: { defaultValue: string } - Tab container. Must have TabsList and TabsContent children.
- TabsList: {} - Container for tab triggers. Can have children.
- TabsTrigger: { value: string, label: string } - Individual tab button.
- TabsContent: { value: string } - Tab panel content. Can have children.

FEEDBACK:
- Alert: { title?: string, message: string, variant?: "default"|"destructive" } - Alert messages.

UTILITY:
- Separator: { orientation?: "horizontal"|"vertical" } - Divider line.
- Empty: { message?: string, icon?: "inbox"|"search"|"file"|"user" } - Empty state placeholder.

UI CONVENTIONS (follow these patterns based on request type):

DASHBOARD requests → Use Grid with 3-4 columns of Metric components inside Cards. Include a Heading at the top. Example structure: Stack > Heading + Grid > [Card > Metric, Card > Metric, ...]

FORM requests → Use Card as container with Stack (vertical, gap="md") for form fields. Group related inputs. End with a horizontal Stack for action buttons.

BUTTON requests → If just a button is requested, output a single Button component. For button groups, use horizontal Stack with gap="sm".

LIST/TABLE requests → Use Card as container. For simple lists, use the List component. For complex data, use Stack with repeated row patterns.

CARD requests → Use Card with title/description props. Content goes inside as children using Stack for layout.

SETTINGS/PREFERENCES → Use Stack with Separator between sections. Each section: Heading + related controls.

EMPTY STATE → Use Empty component with appropriate icon and message.

SPACING & LAYOUT AWARENESS:
- Always wrap multiple sibling elements in a Stack or Grid - never have loose siblings
- Use consistent gap sizes: "sm" for tight groups (buttons), "md" for standard spacing, "lg" for section separation
- Use Box with padding for inner spacing when Card padding isn't enough
- Align related elements: use Stack with align="center" for horizontally centered content
- For centered layouts, wrap content in Box with align="center"

TEXT HIERARCHY:
- Titles/headers should always be larger than body text beneath them
- Use Heading level="2" or "3" for main titles, level="3" or "4" for subsections
- Body text inside cards/containers should use Text with size="base" or "sm"
- Muted variant (variant="muted") works well for secondary/supporting text

OUTPUT FORMAT - You MUST output JSONL (one JSON object per line) with these exact patch operations:

1. First, set the root element key:
{"op":"set","path":"/root","value":"root-element-key"}

2. Then add each element to /elements/{key}:
{"op":"set","path":"/elements/{key}","value":{"key":"{key}","type":"ComponentType","props":{...},"children":["child-key-1","child-key-2"]}}

CRITICAL RULES:
- Output ONLY valid JSONL - one JSON object per line
- NO markdown, NO explanation, NO code blocks, NO extra text
- Every element MUST have: key, type, props
- children is an array of string keys (not nested objects)
- Use descriptive keys like "main-card", "welcome-heading", "submit-btn"
- Parent elements must list their children's keys in the children array
- Output root first, then all elements

EXAMPLE for "Create a welcome card with greeting and button":
{"op":"set","path":"/root","value":"welcome-card"}
{"op":"set","path":"/elements/welcome-card","value":{"key":"welcome-card","type":"Card","props":{"title":"Welcome","description":"Get started with our app"},"children":["greeting-text","start-btn"]}}
{"op":"set","path":"/elements/greeting-text","value":{"key":"greeting-text","type":"Text","props":{"text":"Hello! Welcome to our app."}}}
{"op":"set","path":"/elements/start-btn","value":{"key":"start-btn","type":"Button","props":{"label":"Get Started","variant":"default"}}}`;

export async function POST(req: Request) {
  console.log("=== /api/json-render POST called ===");

  const body = await req.json();
  console.log("Request body:", JSON.stringify(body, null, 2));

  // useUIStream sends { prompt: string, context?: object, currentTree: object }
  const prompt = body.prompt;
  console.log("Prompt:", prompt);

  if (!prompt) {
    console.log("No prompt found, returning error");
    return new Response("Missing prompt", { status: 400 });
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: SYSTEM_PROMPT,
    prompt: `Generate UI components for: ${prompt}`,
    temperature: 0.7,
  });

  console.log("streamText called, returning response");
  return result.toTextStreamResponse();
}
