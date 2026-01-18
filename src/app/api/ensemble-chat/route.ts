import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED SYSTEM PROMPT FOR ALL GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

const GENERATOR_SYSTEM_PROMPT = `You are a UI generator that outputs JSONL patches to build component trees.

OUTPUT FORMAT - You MUST output JSONL (one JSON object per line) with these exact patch operations:

1. First, set the root element key:
{"op":"set","path":"/root","value":"root-element-key"}

2. Then add each element to /elements/{key}:
{"op":"set","path":"/elements/{key}","value":{"key":"{key}","type":"ComponentType","props":{...},"children":["child-key-1","child-key-2"]}}

AVAILABLE COMPONENTS:

LAYOUT:
- Card: { title?: string, description?: string } - Container with header. Can have children.
- Stack: { direction?: "horizontal"|"vertical", gap?: "sm"|"md"|"lg", align?: "start"|"center"|"end"|"stretch" } - Flex container. Can have children.
- Grid: { columns?: 1-6, gap?: "sm"|"md"|"lg" } - Grid layout. Can have children.
- Box: { padding?: "none"|"sm"|"md"|"lg"|"xl", rounded?: "none"|"sm"|"md"|"lg"|"xl"|"full", border?: boolean, shadow?: "none"|"sm"|"md"|"lg", align?: "left"|"center"|"right" } - Spacing container. Can have children.

TYPOGRAPHY:
- Heading: { text: string, level?: "1"|"2"|"3"|"4" } - Headings h1-h4.
- Text: { text: string, variant?: "default"|"muted"|"error"|"success", size?: "sm"|"base"|"lg" } - Paragraphs.
- Label: { text: string, htmlFor?: string } - Form labels.

DATA DISPLAY:
- Icon: { name: "heart"|"star"|"sparkles"|"gift"|"party"|"cake"|"trophy"|"rocket"|"check"|"check-circle"|"x"|"arrow-right"|"arrow-left"|"plus"|"minus"|"info"|"warning"|"zap"|"smile"|"thumbs-up", size?: "sm"|"md"|"lg"|"xl" } - Icons.
- Metric: { label: string, value: string, change?: string, trend?: "up"|"down"|"neutral" } - KPI display.
- Badge: { text: string, variant?: "default"|"secondary"|"destructive"|"outline" } - Status badges.
- Avatar: { src?: string, fallback: string, alt?: string } - User avatars.
- List: { items: string[], ordered?: boolean } - Lists of strings.

FORM:
- Button: { label: string, variant?: "default"|"destructive"|"outline"|"secondary"|"ghost"|"link", size?: "default"|"sm"|"lg"|"icon" } - Buttons.
- Input: { label?: string, placeholder?: string, type?: "text"|"email"|"password"|"number"|"search"|"tel"|"url" } - Text inputs.
- Textarea: { label?: string, placeholder?: string, rows?: 2-10 } - Multi-line input.
- Checkbox: { label: string, checked?: boolean } - Checkbox with label.

TABS:
- Tabs: { defaultValue: string } - Tab container. Children: TabsList, TabsContent.
- TabsList: {} - Container for triggers. Can have children.
- TabsTrigger: { value: string, label: string } - Tab button.
- TabsContent: { value: string } - Tab panel. Can have children.

FEEDBACK:
- Alert: { title?: string, message: string, variant?: "default"|"destructive" } - Alert messages.

UTILITY:
- Separator: { orientation?: "horizontal"|"vertical" } - Divider line.
- Empty: { message?: string, icon?: "inbox"|"search"|"file"|"user" } - Empty state.

CRITICAL RULES:
- Output ONLY valid JSONL - one JSON object per line
- NO markdown, NO explanation, NO code blocks, NO extra text
- Output root first, then all elements
- Every element needs: key, type, props
- children is array of string keys
- Use descriptive keys: "main-card", "submit-btn"
- Always wrap siblings in Stack or Grid`;

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATOR PROMPT VARIANTS (for A/B testing merge strategies)
// ─────────────────────────────────────────────────────────────────────────────

const EVALUATOR_PROMPTS = {
  // Variant A: Simple merge - minimal instructions
  mergeSimple: `You are a UI quality evaluator. Given three JSON outputs from different AI models, merge them into ONE optimal output.

Take the best elements from each and create a single, valid JSONL output.

Respond with ONLY valid JSONL (no explanation, no markdown).`,

  // Variant B: Structured merge - explicit criteria
  mergeStructured: `You are a UI quality evaluator. Given three JSON outputs from different AI models for the same UI request, CREATE AN OPTIMAL MERGED OUTPUT.

MERGE CRITERIA:
1. Structure: Use the most logical component hierarchy from any output
2. Completeness: Include all UI elements the user requested
3. Props: Choose the best prop values (labels, variants, etc.)
4. Layout: Prefer outputs with proper spacing (Stack/Grid with gaps)

PROCESS:
1. Identify the best root structure
2. For each component type, pick the best implementation
3. Combine into valid JSONL

Respond with ONLY valid JSONL (no explanation, no markdown).`,

  // Variant C: Weighted merge - score then combine
  mergeWeighted: `You are a UI quality evaluator. Given three JSON outputs from different AI models, create a merged output using weighted selection.

SCORING (internal, don't output):
- Score each output's JSON validity (0-10)
- Score each output's completeness (0-10)
- Score each output's UX quality (0-10)

MERGE APPROACH:
- Use structure from highest-scoring output as base
- Cherry-pick better component implementations from others
- Fix any issues found in individual outputs

Respond with ONLY the final merged JSONL (no scores, no explanation, no markdown).`,

  // Variant D: Consensus merge - majority patterns
  mergeConsensus: `You are a UI quality evaluator. Given three JSON outputs from different AI models, merge using CONSENSUS patterns.

CONSENSUS RULES:
1. If 2+ outputs use the same component type for an element, use that type
2. If 2+ outputs use similar structure, follow that structure
3. For props, prefer values that appear in multiple outputs
4. If no consensus, pick the most complete/correct option

OUTPUT:
- Valid JSONL combining consensus decisions
- Include all elements the user requested

Respond with ONLY valid JSONL (no explanation, no markdown).`,
};

type EvaluatorVariant = keyof typeof EVALUATOR_PROMPTS;

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CONFIGURATIONS
// ─────────────────────────────────────────────────────────────────────────────

const MODELS = {
  claudeHaiku: anthropic("claude-haiku-4-5-20251001"),
  geminiFlash: google("gemini-2.0-flash"),
  gpt4o: openai("gpt-4o"),
  // Evaluator uses a stronger model
  evaluator: anthropic("claude-sonnet-4-20250514"),
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json();
  const {
    prompt,
    evaluatorVariant = "mergeSimple",
  }: { prompt: string; evaluatorVariant?: EvaluatorVariant } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1: Call all 3 models in parallel
  // ─────────────────────────────────────────────────────────────────────────

  const generatorPromises = [
    // Claude Haiku
    generateText({
      model: MODELS.claudeHaiku,
      system: GENERATOR_SYSTEM_PROMPT,
      prompt: `Generate UI components for: ${prompt}`,
      temperature: 0.7,
      experimental_telemetry: {
        isEnabled: true,
        metadata: {
          generator: "claude-haiku-4-5-20251001",
          variant: evaluatorVariant,
        },
      },
    }),
    // Gemini Flash
    generateText({
      model: MODELS.geminiFlash,
      system: GENERATOR_SYSTEM_PROMPT,
      prompt: `Generate UI components for: ${prompt}`,
      temperature: 0.7,
      experimental_telemetry: {
        isEnabled: true,
        metadata: {
          generator: "gemini-2.0-flash",
          variant: evaluatorVariant,
        },
      },
    }),
    // GPT-4o Mini
    generateText({
      model: MODELS.gpt4o,
      system: GENERATOR_SYSTEM_PROMPT,
      prompt: `Generate UI components for: ${prompt}`,
      temperature: 0.7,
      experimental_telemetry: {
        isEnabled: true,
        metadata: {
          generator: "gpt-4o",
          variant: evaluatorVariant,
        },
      },
    }),
  ];

  const [claudeResult, geminiResult, gptResult] = await Promise.all(
    generatorPromises.map((p) =>
      p.catch((e) => ({ text: "", error: e.message, usage: null }))
    )
  );

  const generatorEndTime = Date.now();

  // Collect outputs
  const outputs = {
    A: { model: "claude-haiku-4.5", text: claudeResult.text || "", usage: (claudeResult as { usage?: unknown }).usage },
    B: { model: "gemini-2.0-flash", text: geminiResult.text || "", usage: (geminiResult as { usage?: unknown }).usage },
    C: { model: "gpt-4o", text: gptResult.text || "", usage: (gptResult as { usage?: unknown }).usage },
  };

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2: Run evaluator to combine/select best output
  // ─────────────────────────────────────────────────────────────────────────

  const evaluatorPrompt = EVALUATOR_PROMPTS[evaluatorVariant];

  const evaluatorInput = `USER REQUEST: "${prompt}"

OUTPUT A (${outputs.A.model}):
${outputs.A.text || "[FAILED TO GENERATE]"}

OUTPUT B (${outputs.B.model}):
${outputs.B.text || "[FAILED TO GENERATE]"}

OUTPUT C (${outputs.C.model}):
${outputs.C.text || "[FAILED TO GENERATE]"}`;

  const evaluatorResult = await generateText({
    model: MODELS.evaluator,
    system: evaluatorPrompt,
    prompt: evaluatorInput,
    temperature: 0.3, // Lower temperature for more consistent evaluation
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        step: "evaluator",
        variant: evaluatorVariant,
      },
    },
  });

  const endTime = Date.now();

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Parse final output and return response
  // ─────────────────────────────────────────────────────────────────────────

  // Extract JSON from evaluator response
  let finalJson = evaluatorResult.text;

  // Clean up any markdown code blocks if present
  finalJson = finalJson
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return new Response(
    JSON.stringify({
      // Final combined/selected output
      result: finalJson,

      // Metadata for analysis
      metadata: {
        evaluatorVariant,
        timing: {
          generatorsMs: generatorEndTime - startTime,
          evaluatorMs: endTime - generatorEndTime,
          totalMs: endTime - startTime,
        },
        generators: {
          A: {
            model: outputs.A.model,
            outputLength: outputs.A.text.length,
            usage: outputs.A.usage,
          },
          B: {
            model: outputs.B.model,
            outputLength: outputs.B.text.length,
            usage: outputs.B.usage,
          },
          C: {
            model: outputs.C.model,
            outputLength: outputs.C.text.length,
            usage: outputs.C.usage,
          },
        },
        evaluator: {
          model: "claude-sonnet-4-20250514",
          usage: evaluatorResult.usage,
        },
      },

      // Raw outputs for debugging/comparison
      rawOutputs: {
        A: outputs.A.text,
        B: outputs.B.text,
        C: outputs.C.text,
        evaluatorFull: evaluatorResult.text,
      },
    }),
    {
      headers: { "Content-Type": "application/json" },
    }
  );
}
