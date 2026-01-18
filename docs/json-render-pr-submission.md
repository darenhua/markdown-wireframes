# PR Submission: json-render Documentation

## PR Title
```
docs: Add useUIStream API reference and JSONL patch format specification
```

---

## PR Description

### Problem

The `useUIStream` hook lacks documentation for:
1. The JSONL patch format it expects from the API
2. The correct function signatures (`send` takes a string, not an object)
3. A working API route example

I discovered these by reading the source code in `packages/react/src/hooks.ts` after hours of debugging.

### Changes

Added "API Route Integration" section to README.md covering:
- JSONL patch format specification
- `useUIStream` hook reference
- Complete API route example

---

## Diff to Add to README.md

Add after the "Basic Usage Pattern" section:

````markdown
## API Route Integration

`useUIStream` expects your API to stream **JSONL patches** (one JSON object per line).

### Patch Format

```jsonl
{"op":"set","path":"/root","value":"my-element"}
{"op":"set","path":"/elements/my-element","value":{"key":"my-element","type":"Card","props":{"title":"Hello"},"children":["child-1"]}}
{"op":"set","path":"/elements/child-1","value":{"key":"child-1","type":"Text","props":{"text":"World"}}}
```

**Paths:**
| Path | Description |
|------|-------------|
| `/root` | Root element key (string) |
| `/elements/{key}` | Element object with `key`, `type`, `props`, and optional `children` (array of keys) |

### useUIStream Reference

```typescript
const { tree, isStreaming, error, send, clear } = useUIStream({
  api: "/api/generate",
  onComplete: (tree) => {},
  onError: (error) => {},
});

// send() takes a STRING, not an object
await send("Create a dashboard");
```

The hook POSTs `{ prompt, context?, currentTree }` to your API.

### Example API Route (Next.js + AI SDK)

```typescript
// app/api/generate/route.ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM_PROMPT = `Output JSONL patches to build UI. Format:
{"op":"set","path":"/root","value":"key"}
{"op":"set","path":"/elements/key","value":{"key":"...","type":"...","props":{...},"children":[...]}}

Rules: One JSON per line. No markdown. children is array of key strings.`;

export async function POST(req: Request) {
  const { prompt } = await req.json();
  const result = streamText({
    model: openai("gpt-4o"),
    system: SYSTEM_PROMPT,
    prompt,
  });
  return result.toTextStreamResponse();
}
```

### Rendering

Wrap `Renderer` with required providers:

```tsx
<DataProvider>
  <VisibilityProvider>
    <ActionProvider>
      <Renderer tree={tree} registry={registry} />
    </ActionProvider>
  </VisibilityProvider>
</DataProvider>
```
````

---

## Quick Commands

```bash
# 1. Fork repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/json-render.git
cd json-render

# 2. Create branch
git checkout -b docs/api-route-integration

# 3. Edit README.md (add section above)

# 4. Commit & push
git add README.md
git commit -m "docs: Add useUIStream API reference and JSONL patch format specification"
git push origin docs/api-route-integration

# 5. Open PR on GitHub
```
