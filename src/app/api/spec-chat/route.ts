import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, tool, type UIMessage } from "ai";
import { z } from "zod";
import {
  writeElementContext,
  getTreeJson,
  analyzeContextCompleteness,
  createInitialContext,
  readElementContext,
  type SelectorInfo
} from "@/app/atoms/(components)/(starter)/with-spec-chat/spec-actions";

function buildSystemPrompt(
  elementKey: string,
  elementType: string,
  elementProps: Record<string, unknown>,
  treeContext: string | null,
  missingFields: string[],
  filledFields: string[],
  currentContext: string
) {
  const propsStr = JSON.stringify(elementProps, null, 2);

  const missingFieldsStr = missingFields.length > 0
    ? `\n\nMISSING FIELDS (ask about these first):\n${missingFields.map(f => `- ${f}`).join("\n")}`
    : "";

  const filledFieldsStr = filledFields.length > 0
    ? `\n\nALREADY FILLED FIELDS:\n${filledFields.map(f => `- ${f}`).join("\n")}`
    : "";

  return `You are a product specification assistant helping users define requirements for UI components.

CURRENT ELEMENT:
- Key: ${elementKey}
- Type: ${elementType}
- Props: ${propsStr}
${missingFieldsStr}
${filledFieldsStr}

CURRENT CONTEXT FILE:
\`\`\`markdown
${currentContext}
\`\`\`

${treeContext ? `FULL UI TREE CONTEXT:\n\`\`\`json\n${treeContext}\n\`\`\`\n` : ""}

YOUR ROLE:
You are guiding the user through a structured spec conversation for this specific component. Your goal is to help them fill in the missing fields in the context file.

PRIORITY ORDER FOR QUESTIONS:
1. First, ask about "Overview" - get a brief description of what this component is
2. Then "User Need" - what user need does this address?
3. Then "Problem Solved" - what problem does it solve?
4. Then "Features" - what are the key features?
5. Continue through remaining missing fields

CRITICAL RULES:
1. You MUST call write_context after EVERY user message - no exceptions
2. You MUST also provide a text response after calling the tool (ask the next question)
3. Never skip the tool call, even if the user's message seems incomplete

CONVERSATION STYLE:
- Your FIRST message should ask about the first missing field
- Ask ONE focused question at a time about a specific missing field
- After EACH answer: call write_context FIRST, then ask the next question
- Keep the full existing content and only update the relevant section
- Be conversational but efficient - short questions, no lengthy explanations

WORKFLOW FOR EVERY MESSAGE:
1. User provides an answer
2. IMMEDIATELY call write_context to update the spec file
3. THEN respond with acknowledgment and ask about the next missing field

TOOL AVAILABLE:
- write_context: Use this to save spec information. ALWAYS include the ENTIRE file content - this overwrites the file.

IMPORTANT:
- Start by asking about the FIRST missing field listed above
- After each answer, update ONLY that specific field while preserving everything else
- ALWAYS use write_context after getting an answer - this is mandatory
- Be brief and direct in your questions
- The context file already exists - your job is to fill in the placeholder fields`;
}

export async function POST(req: Request) {
  const {
    messages,
    pageName,
    elementKey,
    treeContext: providedTreeContext,
    elementContext,
    selectors,
  }: {
    messages: UIMessage[];
    pageName: string;
    elementKey: string;
    treeContext: string | null;
    elementContext: string | null;
    selectors?: SelectorInfo;
  } = await req.json();

  console.log("[spec-chat] Request received:", { pageName, elementKey, hasProvidedTree: !!providedTreeContext });

  // Load tree directly from file system if not provided
  let treeContext = providedTreeContext;
  let treeData: Awaited<ReturnType<typeof getTreeJson>> = null;

  if (!treeContext && pageName) {
    console.log("[spec-chat] Loading tree from file system for:", pageName);
    treeData = await getTreeJson(pageName);
    console.log("[spec-chat] Tree loaded:", treeData ? "success" : "failed");
    if (treeData) {
      treeContext = JSON.stringify(treeData, null, 2);
    }
  } else if (treeContext) {
    console.log("[spec-chat] Using provided tree context, length:", treeContext.length);
    try {
      treeData = JSON.parse(treeContext);
    } catch {
      // Keep treeContext as string
    }
  }

  // Warn if we still don't have tree context
  if (!treeContext) {
    console.warn("[spec-chat] WARNING: No tree context available! pageName:", pageName);
  }

  // Extract element type and props from context or tree data
  let elementType = "Unknown";
  let elementProps: Record<string, unknown> = {};

  if (elementContext) {
    try {
      const parsed = JSON.parse(elementContext);
      elementType = parsed.type || "Unknown";
      elementProps = parsed.props || {};
    } catch {
      // Use defaults
    }
  } else if (treeData && elementKey && treeData.elements[elementKey]) {
    // Fallback: get element info from tree data
    const element = treeData.elements[elementKey];
    elementType = element.type || "Unknown";
    elementProps = element.props || {};
  }

  // Build selector info
  const selectorInfo: SelectorInfo = {
    elementKey,
    ...selectors,
  };

  // Create initial context file if this is the first message (or ensure it exists)
  if (messages.length <= 1) {
    console.log("[spec-chat] First message - creating initial context file");
    await createInitialContext(pageName, elementKey, selectorInfo);
  }

  // Read current context and analyze completeness
  const currentContext = await readElementContext(pageName, elementKey);
  const { filled, missing } = await analyzeContextCompleteness(currentContext);
  console.log("[spec-chat] Context analysis:", { filled, missing });

  const systemPrompt = buildSystemPrompt(
    elementKey,
    elementType,
    elementProps,
    treeContext,
    missing,
    filled,
    currentContext
  );

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: {
      write_context: tool({
        description:
          "Write or update the context.md specification file. You MUST call this after every user message. Include all previously captured context - this overwrites the entire file.",
        inputSchema: z.object({
          content: z
            .string()
            .describe("The full markdown content for context.md"),
        }),
        execute: async ({ content }) => {
          console.log("[spec-chat] write_context called:", { pageName, elementKey, contentLength: content.length });
          if (!pageName || !elementKey) {
            console.error("[spec-chat] Missing pageName or elementKey for write_context");
            return "Failed to update spec file: missing page or element information.";
          }
          const result = await writeElementContext(
            pageName,
            elementKey,
            content,
            selectorInfo
          );
          console.log("[spec-chat] write_context result:", result);
          return result.success
            ? `Spec file updated successfully. Component ID: ${result.componentId}`
            : "Failed to update spec file.";
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
