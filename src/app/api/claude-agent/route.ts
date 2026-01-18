import { query } from "@anthropic-ai/claude-agent-sdk";
import { NextRequest } from "next/server";
import path from "path";

const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { prompt, pageName, systemPrompt } = body;

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build the full system prompt with file operation context
  const fullSystemPrompt = `You are a helpful assistant that helps users document and specify UI components.
Your primary job is to:
1. Read existing context files and project structure
2. Have conversations with users about component specifications
3. Write and update context.md files in the appropriate locations

IMPORTANT FILE PATHS:
- Working directory: ${process.cwd()}
- Outputs directory: ${OUTPUTS_ROOT}
${pageName ? `- Current page: ${path.join(OUTPUTS_ROOT, pageName)}` : ""}
${pageName ? `- Components directory: ${path.join(OUTPUTS_ROOT, pageName, "components")}` : ""}

When writing context.md files, use the following template structure:
\`\`\`markdown
# Component Spec: [Component Name]

## Overview
[Brief description of this component]

## Purpose (Why)
- **User Need**: [What user need does this address?]
- **Problem Solved**: [What problem does it solve?]
- **Product Vision**: [How does it fit into the larger product?]

## Definition (What)
### Features
- [Key features]

### Behaviors
- [Interaction patterns]

### Constraints
- [Limitations, edge cases]

## Implementation (How)
### Data Requirements
- [Data sources, APIs]

### Interactions
- [Events, handlers]

### Technical Notes
- [Stack considerations]

## Open Questions
- [Unresolved items]
\`\`\`

${systemPrompt || ""}

Be conversational and ask clarifying questions to help users fill out the specification. Update the context.md file as you gather information.`;

  // Create a readable stream for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Use the Claude Agent SDK
        for await (const message of query({
          prompt,
          options: {
            systemPrompt: fullSystemPrompt,
            allowedTools: ["Read", "Write", "Edit", "Glob", "Grep"],
            permissionMode: "acceptEdits",
            cwd: pageName ? path.join(OUTPUTS_ROOT, pageName) : OUTPUTS_ROOT,
          },
        })) {
          // Send each message as an SSE event
          const eventData = JSON.stringify(message);
          controller.enqueue(encoder.encode(`data: ${eventData}\n\n`));
        }

        // Send done event
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (error) {
        console.error("Claude Agent SDK error:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
