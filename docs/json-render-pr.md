# PR: Documentation for API Route Integration

## Overview

This document outlines the steps and content for submitting a PR to [vercel-labs/json-render](https://github.com/vercel-labs/json-render) to improve documentation around API route integration and the `useUIStream` hook.

---

## Steps to Submit the PR

### 1. Fork the Repository

```bash
# Go to https://github.com/vercel-labs/json-render
# Click "Fork" in the top right
```

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/json-render.git
cd json-render
```

### 3. Create a Branch

```bash
git checkout -b docs/api-route-integration
```

### 4. Make the Changes

Edit `README.md` to add the new section (see "Documentation to Add" below), or create a new file at `docs/api-integration.md`.

### 5. Commit and Push

```bash
git add .
git commit -m "docs: Add API route integration guide with JSONL patch format specification"
git push origin docs/api-route-integration
```

### 6. Create the Pull Request

Go to your fork on GitHub and click "Compare & pull request". Use the PR description below.

---

## PR Title

```
docs: Add API route integration guide with JSONL patch format specification
```

---

## PR Description

```markdown
## Summary

This PR adds documentation for integrating `useUIStream` with a backend API route, including the expected JSONL patch format specification.

## Problem

Currently, developers using `@json-render/react` face significant friction when setting up the API route because:

1. **The JSONL patch format is not documented** - The exact structure expected by `useUIStream`'s internal `applyPatch` function is not specified anywhere in the README or docs.

2. **`useUIStream` API is unclear** - The hook's `send()` function takes a `string`, not an object, but this isn't obvious from the examples.

3. **No working API route example** - Developers have to reverse-engineer the expected format by reading the library source code.

I spent several hours debugging why my implementation wasn't working, only to discover (by reading `packages/react/src/hooks.ts`) that:
- The patch format uses `/root` and `/elements/{key}` paths, not JSON Pointer paths like `/children/-`
- `send(prompt)` takes a string directly, not `{ prompt }`
- The hook returns `isStreaming` (not `status`) and `clear()` (not `reset()`)

## Changes

- Added "API Route Integration" section to README with:
  - JSONL patch format specification
  - Path reference table
  - Complete working API route example (Next.js + Vercel AI SDK)
  - Correct `useUIStream` usage example

## Testing

- Verified the documented format works with a local implementation
- Confirmed patch parsing matches the `applyPatch` function in `packages/react/src/hooks.ts`
```

---

## Documentation to Add

Add this section to `README.md` after the "Basic Usage Pattern" section:

````markdown
## API Route Integration

The `useUIStream` hook fetches from your API endpoint and expects a streaming response of **JSONL patches** (one JSON object per line, also known as newline-delimited JSON).

### JSONL Patch Format

Your API must stream patches in this exact format:

```jsonl
{"op":"set","path":"/root","value":"element-key"}
{"op":"set","path":"/elements/{key}","value":{"key":"...","type":"...","props":{...},"children":[...]}}
```

#### Path Reference

| Path | Operation | Description |
|------|-----------|-------------|
| `/root` | `set` | Sets the root element key (a string referencing an element) |
| `/elements/{key}` | `set`, `add`, `replace` | Creates or updates an element in the tree |
| `/elements/{key}/{prop}` | `set`, `add`, `replace` | Updates a specific property of an element |
| `/elements/{key}` | `remove` | Removes an element from the tree |

#### Element Structure

Each element in `/elements/{key}` must have this structure:

```typescript
{
  key: string;        // Unique identifier (must match the path key)
  type: string;       // Component type from your catalog
  props: object;      // Props to pass to the component
  children?: string[]; // Array of child element keys (not nested objects!)
  visible?: VisibilityCondition; // Optional visibility rules
}
```

### Example: Complete API Route (Next.js App Router + Vercel AI SDK)

```typescript
// app/api/generate/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are a UI generator that outputs JSONL patches.

Output format (one JSON object per line):
{"op":"set","path":"/root","value":"root-element-key"}
{"op":"set","path":"/elements/{key}","value":{"key":"...","type":"...","props":{...},"children":[...]}}

Rules:
- Output ONLY valid JSONL - one JSON object per line
- NO markdown, NO explanation, NO code blocks
- Every element must have: key, type, props
- children is an array of key strings (not nested objects)
- Parent elements must list their children's keys in the children array

Example for "Create a welcome card":
{"op":"set","path":"/root","value":"welcome-card"}
{"op":"set","path":"/elements/welcome-card","value":{"key":"welcome-card","type":"Card","props":{"title":"Welcome"},"children":["greeting","btn"]}}
{"op":"set","path":"/elements/greeting","value":{"key":"greeting","type":"Text","props":{"text":"Hello!"}}}
{"op":"set","path":"/elements/btn","value":{"key":"btn","type":"Button","props":{"label":"Get Started"}}}`;

export async function POST(req: Request) {
  // useUIStream sends: { prompt: string, context?: object, currentTree: object }
  const { prompt } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    prompt: `Generate UI for: ${prompt}`,
  });

  return result.toTextStreamResponse();
}
```

### useUIStream Hook Reference

```typescript
import { useUIStream } from "@json-render/react";

const {
  tree,        // UITree | null - The current component tree
  isStreaming, // boolean - True while receiving patches
  error,       // Error | null - Any fetch/parse errors
  send,        // (prompt: string, context?: object) => Promise<void>
  clear,       // () => void - Reset tree to null
} = useUIStream({
  api: "/api/generate",           // Your API endpoint
  onComplete: (tree) => {},       // Called when streaming finishes
  onError: (error) => {},         // Called on errors
});

// IMPORTANT: send() takes a string directly, not an object
await send("Create a dashboard with metrics");

// The hook sends this to your API:
// { prompt: "Create a dashboard...", context: undefined, currentTree: { root: "", elements: {} } }
```

### Rendering the Tree

The `Renderer` component requires context providers:

```tsx
import {
  Renderer,
  DataProvider,
  VisibilityProvider,
  ActionProvider
} from "@json-render/react";

function App() {
  const { tree, isStreaming, send } = useUIStream({ api: "/api/generate" });

  return (
    <DataProvider>
      <VisibilityProvider>
        <ActionProvider>
          {tree && (
            <Renderer
              tree={tree}
              registry={registry}  // Your component registry
              loading={isStreaming}
            />
          )}
        </ActionProvider>
      </VisibilityProvider>
    </DataProvider>
  );
}
```

Or use the combined `JSONUIProvider`:

```tsx
import { Renderer, JSONUIProvider } from "@json-render/react";

function App() {
  const { tree, isStreaming } = useUIStream({ api: "/api/generate" });

  return (
    <JSONUIProvider registry={registry}>
      {tree && <Renderer tree={tree} registry={registry} loading={isStreaming} />}
    </JSONUIProvider>
  );
}
```
````

---

## Files to Modify

| File | Action |
|------|--------|
| `README.md` | Add the "API Route Integration" section after "Basic Usage Pattern" |
| `packages/react/src/hooks.ts` | (Optional) Add JSDoc comments to `useUIStream` |

---

## Optional: Add JSDoc to Source

If you want to go further, you could also add JSDoc comments to the hook:

```typescript
/**
 * Hook for streaming UI generation from an API endpoint.
 *
 * @example
 * ```tsx
 * const { tree, isStreaming, send, clear } = useUIStream({
 *   api: "/api/generate",
 * });
 *
 * // send takes a string, not an object
 * await send("Create a dashboard");
 * ```
 *
 * Your API should return JSONL patches:
 * ```jsonl
 * {"op":"set","path":"/root","value":"element-key"}
 * {"op":"set","path":"/elements/element-key","value":{"key":"...","type":"...","props":{...}}}
 * ```
 */
export function useUIStream({ api, onComplete, onError }: UseUIStreamOptions): UseUIStreamReturn {
  // ...
}
```

---

## Checklist Before Submitting

- [ ] Forked the repo
- [ ] Created a feature branch
- [ ] Added documentation to README.md
- [ ] Tested that the documented format actually works
- [ ] Wrote clear PR description
- [ ] Linked to any relevant issues (search for existing issues about documentation)
