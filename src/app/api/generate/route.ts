import { streamText } from "ai";
import { generateCatalogPrompt } from "@json-render/core";
import { catalog } from "@/lib/catalog";

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const systemPrompt = generateCatalogPrompt(catalog);

  const result = streamText({
    model: "anthropic/claude-haiku-4.5",
    system: systemPrompt,
    prompt,
  });

  return new Response(result.textStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
