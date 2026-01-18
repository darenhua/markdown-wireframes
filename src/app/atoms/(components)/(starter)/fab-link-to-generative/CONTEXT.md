# Fab Link to Generative - Context

## Overview

This component provides a floating action bar (FAB) with multiple tool modes. The **hammer icon** activates a special "generative" mode that renders UI from JSON trees using `@json-render/react`.

## Two Render Views

There are two ways the same UI tree gets rendered:

### 1. JSON View (Hammer Mode)
- **When**: User clicks the hammer icon in the floating bar
- **What**: Renders the `tree.json` from the current route's output folder using `@json-render/react` Renderer
- **Where**: Main content area of `fab-link-to-generative/page.tsx`
- **Container**: `<div className="h-full w-full overflow-auto p-6">` (regular div, allows natural content width)

### 2. Page.tsx View (Router Mode)
- **When**: Any other icon is selected (pointer, ai, notes, files)
- **What**: Renders the actual React component from `outputs/{folder}/page.tsx` via React Router
- **Where**: Same main content area, but via `<RouterProvider>`
- **Container**: `<ScrollArea className="h-full w-full p-6">` (forces full width via `min-width: 100%; display: table`)

## Design Intent

**The JSON view should match the Page.tsx view visually** - same width, same styling.

- Initially, the JSON view was WIDER because ScrollArea forces `min-width: 100%`
- User preference: JSON view should be SKINNIER to match Page.tsx view
- Solution: Removed ScrollArea from hammer mode, use regular div with `overflow-auto`

## Auto-Save Behavior

When the user modifies UI via the hammer mode's follow-up prompts:
1. AI streams modifications to the tree
2. On stream completion (`onComplete`), the tree is auto-saved to:
   - `outputs/{folder}/tree.json` - raw tree data
   - `outputs/{folder}/page.tsx` - generated React component with proper imports
   - `outputs/{folder}/registry.tsx` - component registry mapping to shadcn/ui

## File Structure

```
outputs/{folder}/
├── tree.json      # JSON tree data
├── page.tsx       # Generated page using @json-render/react
└── registry.tsx   # Component registry with shadcn imports
```

## Key Files

- `page.tsx` - Main component with FAB and dual render modes
- `actions.ts` - Server actions for loading/saving tree.json and generating page.tsx/registry.tsx
- `../followup-prompts/registry.tsx` - Source registry used for rendering
- `../followup-prompts/useFollowUpStream.ts` - Hook for streaming AI modifications
