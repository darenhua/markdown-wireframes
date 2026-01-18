import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are a helpful AI assistant. When providing code examples, use markdown code blocks with the appropriate language identifier. When explaining UI concepts, feel free to provide code snippets.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    const result = streamText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: SYSTEM_PROMPT,
      messages: messages,
      temperature: 0.7,
    });

    // Create a custom stream that appends token usage at the end
    const encoder = new TextEncoder();

    const customStream = new ReadableStream({
      async start(controller) {
        try {
          // Stream the text content
          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(chunk));
          }

          // After streaming completes, append token usage metadata
          const usage = await result.usage;
          const tokenMetadata = `\n[[TOKENS:${JSON.stringify(usage)}]]`;
          controller.enqueue(encoder.encode(tokenMetadata));

          controller.close();
        } catch (streamError) {
          console.error("Stream error:", streamError);
          controller.error(streamError);
        }
      },
    });

    return new Response(customStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
