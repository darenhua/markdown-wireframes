import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

const SPEC_TEMPLATE = `# Component Spec: {elementKey}

## Overview
[Brief description of this component]

## Purpose (Why)
- **User Need**: [What user need does this address?]
- **Problem Solved**: [What problem does it solve?]

## Features
- [Key features]

## Behaviors
- [Interaction patterns]

## Constraints
- [Limitations, edge cases]
`;

export async function POST(req: Request) {
  const { currentContext, userMessage, elementKey, elementType } = await req.json();

  const systemPrompt = `You are helping fill out a component specification for a UI element.

RULES:
1. Ask ONE question at a time to gather information
2. When the user answers, update the spec and ask the next question
3. Be conversational but concise in your questions
4. Keep the same section structure but fill in details based on user answers

OUTPUT FORMAT - You MUST use this EXACT format with these delimiters:
---QUESTION---
[Your conversational response/question here - be friendly and brief]
---MARKDOWN---
[The complete updated markdown spec here]
---END---

IMPORTANT:
- Always output BOTH sections
- The QUESTION section is shown in chat - keep it brief and conversational
- The MARKDOWN section is the full updated spec file
- Never skip either section

The user is specifying a "${elementType}" component called "${elementKey}".`;

  const prompt = currentContext
    ? `CURRENT SPEC:\n${currentContext}\n\nUSER'S RESPONSE:\n${userMessage}\n\nProvide your response in the required format (---QUESTION---, ---MARKDOWN---, ---END---).`
    : `Start with this template:\n${SPEC_TEMPLATE.replace("{elementKey}", elementKey)}\n\nAsk the first question about the Overview section. Use the required format (---QUESTION---, ---MARKDOWN---, ---END---).`;

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    prompt,
    temperature: 0.7,
  });

  return result.toTextStreamResponse();
}
