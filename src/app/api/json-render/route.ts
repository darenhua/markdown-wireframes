import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are a UI generator that outputs JSONL patches to build component trees.

Available components (use these exact type names):
- Card: { title?: string } - Container with optional title. Can have children array.
- Stack: { direction?: "horizontal"|"vertical", gap?: "sm"|"md"|"lg" } - Flex container. Can have children.
- Grid: { columns?: 1-4, gap?: "sm"|"md"|"lg" } - Grid layout. Can have children.
- Heading: { text: string, level?: "1"|"2"|"3" } - Headings.
- Text: { text: string, variant?: "default"|"muted"|"error"|"success" } - Paragraphs.
- Metric: { label: string, value: string, change?: string, trend?: "up"|"down"|"neutral" } - KPI display.
- Badge: { text: string, variant?: "default"|"success"|"warning"|"error"|"info" } - Status badges.
- List: { items: string[], ordered?: boolean } - Lists of strings.
- Button: { label: string, variant?: "default"|"primary"|"secondary"|"ghost" } - Buttons.
- Input: { label?: string, placeholder?: string, type?: "text"|"email"|"password"|"number" } - Form inputs.
- Alert: { message: string, variant?: "info"|"success"|"warning"|"error" } - Alert messages.
- Divider: {} - Horizontal line separator.
- Empty: { message?: string } - Empty state placeholder.

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
{"op":"set","path":"/elements/welcome-card","value":{"key":"welcome-card","type":"Card","props":{"title":"Welcome"},"children":["greeting-text","start-btn"]}}
{"op":"set","path":"/elements/greeting-text","value":{"key":"greeting-text","type":"Text","props":{"text":"Hello! Welcome to our app."}}}
{"op":"set","path":"/elements/start-btn","value":{"key":"start-btn","type":"Button","props":{"label":"Get Started","variant":"primary"}}}`;

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
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    prompt: `Generate UI components for: ${prompt}`,
    temperature: 0.7,
  });

  console.log("streamText called, returning response");
  return result.toTextStreamResponse();
}
