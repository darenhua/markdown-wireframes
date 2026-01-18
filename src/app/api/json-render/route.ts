import { catalog } from "@/app/atoms/(components)/(starter)/try-jsonrender/catalog";
import { openai } from "@ai-sdk/openai";
import { generateCatalogPrompt } from "@json-render/core";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are a UI generator that outputs JSONL patches to build component trees.
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

const FOLLOWUP_PROMPT = `
FOLLOW-UP MODE - DELTA PATCHES ONLY:
You are modifying an existing UI. Output ONLY patches for elements that CHANGE.
DO NOT re-output unchanged elements - they already exist in the UI.

CURRENT UI STATE:
{CURRENT_TREE}

DELTA OUTPUT RULES:
- NEW elements: {"op":"set","path":"/elements/{key}","value":{...}}
- MODIFIED elements: {"op":"set","path":"/elements/{key}","value":{...}} with new props
- MODIFIED props only: {"op":"set","path":"/elements/{key}/props/title","value":"New Title"}
- DELETED elements: {"op":"remove","path":"/elements/{key}"}
- Update children array when adding/removing children: {"op":"set","path":"/elements/{key}/children","value":["existing","new-child"]}
- Root change (rare): {"op":"set","path":"/root","value":"new-root-key"}

CRITICAL: DO NOT re-output unchanged elements. Only output what changes.

EXAMPLE - User says "Add a logout button" to existing welcome-card with children ["greeting-text","start-btn"]:
{"op":"set","path":"/elements/logout-btn","value":{"key":"logout-btn","type":"Button","props":{"label":"Logout","variant":"ghost"}}}
{"op":"set","path":"/elements/welcome-card/children","value":["greeting-text","start-btn","logout-btn"]}

EXAMPLE - User says "Change the heading to say Hello World":
{"op":"set","path":"/elements/main-heading/props/text","value":"Hello World"}

EXAMPLE - User says "Remove the subtitle":
{"op":"remove","path":"/elements/subtitle-text"}
{"op":"set","path":"/elements/parent-stack/children","value":["heading","button"]}

Only output the minimal patches needed to achieve the requested change.`;

export async function POST(req: Request) {
  console.log("=== /api/json-render POST called ===");

  const body = await req.json();
  console.log("Request body:", JSON.stringify(body, null, 2));

  const catalogPrompt = generateCatalogPrompt(catalog);
  const prompt = body.prompt;
  const context = body.context;
  const currentTree = context?.currentTree;

  console.log("Prompt:", prompt);
  console.log("Has currentTree:", !!currentTree);

  if (!prompt) {
    console.log("No prompt found, returning error");
    return new Response("Missing prompt", { status: 400 });
  }

  // Build system prompt based on whether we're in follow-up mode
  let finalSystemPrompt = SYSTEM_PROMPT;

  if (currentTree) {
    // Add follow-up context with the current tree
    const followupContext = FOLLOWUP_PROMPT.replace(
      "{CURRENT_TREE}",
      JSON.stringify(currentTree, null, 2)
    );
    finalSystemPrompt = `${SYSTEM_PROMPT}\n\n${followupContext}`;
  }

  finalSystemPrompt = `${finalSystemPrompt}\n\n${catalogPrompt}`;

  const userPrompt = currentTree
    ? `Modify the existing UI: ${prompt}`
    : `Generate UI components for: ${prompt}`;

  const result = streamText({
    model: openai("gpt-4o"),
    system: finalSystemPrompt,
    prompt: userPrompt,
    temperature: 0.7,
  });

  console.log("streamText called, returning response");
  return result.toTextStreamResponse();
}
