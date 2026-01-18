import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import {
  writeElementContext,
  createInitialContext,
  type SelectorInfo,
} from "@/app/atoms/(components)/(starter)/with-spec-chat/spec-actions";

const SYSTEM_PROMPT = `You are a helpful assistant that extracts and tracks user requirements from conversations.

CRITICAL RULES:
1. You MUST call write_context after EVERY user message - no exceptions
2. You MUST also provide a conversational text response after calling the tool
3. Never skip the tool call, even if the user's message seems trivial

WORKFLOW FOR EVERY MESSAGE:
1. Read the user's message
2. IMMEDIATELY call write_context to update the context file with any new information
3. THEN provide your conversational response

As you chat with the user, identify and extract:
- User requirements and specifications
- Preferences and constraints
- Key decisions made
- Important context about their project or goals
- Even casual mentions or preferences

The context file should be written in Markdown format with clear sections like:

# Project Context

## Requirements
- Requirement 1
- Requirement 2

## Preferences
- Preference 1

## Decisions
- Decision 1

## Notes
- Any other important context

## Conversation Summary
- Brief notes from each exchange

Update the context file incrementally as new information emerges. Always include all previously captured context when updating - this overwrites the entire file, so include everything.

Be conversational, helpful, and engaging. Ask clarifying questions. Offer suggestions.

REMEMBER: Call write_context on EVERY message, then respond with text.`;

export async function POST(req: Request) {
  const {
    messages,
    pageName,
    elementKey,
    selectors,
  }: {
    messages: UIMessage[];
    pageName?: string;
    elementKey?: string;
    selectors?: SelectorInfo;
  } = await req.json();

  // Build selector info
  const selectorInfo: SelectorInfo = {
    elementKey: elementKey || "chat-context",
    ...selectors,
  };

  // Use default page name if not provided
  const effectivePageName = pageName || "default";
  const effectiveElementKey = elementKey || "chat-context";

  // Create initial context file if pageName is provided
  if (pageName && messages.length <= 1) {
    await createInitialContext(effectivePageName, effectiveElementKey, selectorInfo);
  }

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      write_context: {
        description:
          "Write or update the context.md file. You MUST call this after every user message. Include all previously captured context - this overwrites the entire file.",
        inputSchema: z.object({
          content: z
            .string()
            .describe(
              "The full markdown content to write to context.md. Should include all requirements, preferences, and decisions captured so far."
            ),
        }),
        execute: async ({ content }: { content: string }) => {
          const result = await writeElementContext(
            effectivePageName,
            effectiveElementKey,
            content,
            selectorInfo
          );
          return result.success
            ? `Context file updated successfully. Component ID: ${result.componentId}`
            : "Failed to update context file.";
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
