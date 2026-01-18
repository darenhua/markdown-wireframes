import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { writeContext } from "@/app/atoms/(components)/(starter)/rachel-v1/actions";

const SYSTEM_PROMPT = `You are a helpful assistant that extracts and tracks user requirements from conversations.

IMPORTANT: Always respond conversationally to the user. When you use the write_context tool, you must ALSO provide a helpful response message - don't just silently update the context.

As you chat with the user, identify and extract:
- User requirements and specifications
- Preferences and constraints
- Key decisions made
- Important context about their project or goals

When you identify important requirements or context, use the write_context tool to update the context file, AND continue the conversation naturally. For example:
1. User shares a requirement
2. You call write_context to save it
3. You ALSO respond with acknowledgment, follow-up questions, or helpful suggestions

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

Update the context file incrementally as new information emerges. Always include all previously captured context when updating - don't overwrite, but append and organize.

Be conversational, helpful, and engaging. Ask clarifying questions. Offer suggestions. The context extraction happens in the background - your primary job is still to be a great conversational assistant.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.2"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      write_context: {
        description:
          "Write or update the context.md file with extracted requirements, preferences, and decisions from the conversation. Always include all previously captured context - this overwrites the entire file.",
        inputSchema: z.object({
          content: z
            .string()
            .describe(
              "The full markdown content to write to context.md. Should include all requirements, preferences, and decisions captured so far."
            ),
        }),
        execute: async ({ content }: { content: string }) => {
          const result = await writeContext(content);
          return result.success
            ? "Context file updated successfully."
            : "Failed to update context file.";
        },
      },
    },
  });

  return result.toUIMessageStreamResponse();
}
