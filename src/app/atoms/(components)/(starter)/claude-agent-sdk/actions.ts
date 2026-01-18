"use server";

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SendMessageParams, StreamChunk } from "./types";

export async function sendMessage(
  params: SendMessageParams
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const result = query({
          prompt: params.prompt,
          options: {
            model: "claude-sonnet-4-20250514",
            maxTurns: 1,
            systemPrompt: params.systemPrompt ?? "You are a helpful AI assistant. Keep responses concise.",
          },
        });

        for await (const message of result) {
          let chunk: StreamChunk | null = null;

          switch (message.type) {
            case "system":
              if (message.subtype === "init") {
                chunk = {
                  type: "init",
                  sessionId: message.session_id,
                  model: message.model,
                };
              }
              break;

            case "assistant":
              if (message.message?.content) {
                for (const block of message.message.content) {
                  if (block.type === "text") {
                    chunk = {
                      type: "text",
                      content: block.text,
                    };
                  }
                }
              }
              break;

            case "result":
              chunk = {
                type: "result",
                content: message.result,
                cost: message.total_cost_usd,
                duration: message.duration_ms,
              };
              break;
          }

          if (chunk) {
            const data = JSON.stringify(chunk) + "\n";
            controller.enqueue(encoder.encode(data));
          }
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
      } catch (error) {
        const errorChunk: StreamChunk = {
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error occurred",
        };
        controller.enqueue(encoder.encode(JSON.stringify(errorChunk) + "\n"));
      } finally {
        controller.close();
      }
    },
  });
}
