# Highlight Linked Elements in JSON View - Implementation Plan

## Overview

Add visual highlighting (border) to elements in the JSON/hammer view that have links to other pages. The simplest approach: elements already have a `linkTo` prop when linked - we just need to modify the registry to add visual styling when that prop exists.

## Current State Analysis

### What We Have:
1. **`element.props.linkTo`** - Already set on elements when a link is created (actions.ts:619)
2. **Two registries**:
   - `followup-prompts/registry.tsx` - Used by new-pages for hammer view rendering
   - `REGISTRY_CONTENT` in actions.ts - Used for generated page.tsx files in outputs/
3. **links.json** - Stores edges with `elementKey` but NOT needed for this feature

### Key Discovery:
The `linkTo` prop is the source of truth. When `addLinkToElement()` runs, it sets:
```typescript
element.props.linkTo = targetPath;  // e.g., "/page-2"
```

**Important**: `new-pages/page.tsx` imports from `"../followup-prompts/registry"` (line 42), so we need to modify `followup-prompts/registry.tsx` for the hammer view highlighting.

We don't need to read links.json or create new context - the information is already in the element props!

## Desired End State

Elements with `linkTo` prop display with a visual indicator:
- Blue/purple ring border around the element
- Small link icon badge in corner (optional)
- Works for all component types (Button, Card, Text, etc.)

## What We're NOT Doing

- NOT reading links.json at render time (unnecessary)
- NOT creating a new React context (overkill)
- NOT modifying @json-render library itself
- NOT adding click handlers (links already work via Button's Link wrapper)

## Implementation Approach

**Strategy**: Create a wrapper component that adds link styling, and use it in registry components.

We need to modify `followup-prompts/registry.tsx` since that's what `new-pages/page.tsx` uses for rendering the hammer view.

## Phase 1: Add LinkHighlight Wrapper to followup-prompts/registry.tsx

### Overview
Add a simple wrapper component to the registry that adds visual styling when `linkTo` exists.

### Changes Required:

#### 1. Add imports for Link and ArrowRight

**File**: `src/app/atoms/(components)/(starter)/followup-prompts/registry.tsx`

Add to imports:
```typescript
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";  // Add to existing lucide imports
```

#### 2. Add LinkHighlight wrapper component (before registry export)

```typescript
// Wrapper for elements with links - adds visual highlight
function LinkHighlight({
  children,
  linkTo,
}: {
  children: React.ReactNode;
  linkTo?: string;
}) {
  if (!linkTo) return <>{children}</>;
  return (
    <div className="relative">
      <div className="absolute inset-0 rounded-lg ring-2 ring-blue-500 ring-offset-2 ring-offset-background pointer-events-none z-10" />
      <div className="absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm">
        <ArrowRight className="h-3 w-3" />
      </div>
      <Link to={linkTo} className="block no-underline">
        {children}
      </Link>
    </div>
  );
}
```

#### 3. Update Button component to use LinkHighlight

```typescript
Button: ({ element }) => {
  const btn = (
    <Button variant={element.props.variant ?? "default"} size={element.props.size ?? "default"}>
      {element.props.label}
    </Button>
  );

  // If has linkTo, wrap with highlight and Link
  if (element.props.linkTo) {
    return (
      <LinkHighlight linkTo={element.props.linkTo}>
        {btn}
      </LinkHighlight>
    );
  }

  return btn;
},
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors
- [ ] No new lint errors

#### Manual Verification:
- [ ] Open an existing page with a linked Button in hammer view
- [ ] Button should have blue ring border and arrow icon badge
- [ ] Click the button - should navigate to linked page

---

## Phase 2: (Optional) Apply to Other Components

If needed, apply the same pattern to Card, Text, Badge etc. Same approach - check `element.props.linkTo` and wrap with `LinkHighlight`.

---

## Testing Strategy

### Manual Testing Steps:
1. Navigate to `/atoms/(components)/(starter)/new-pages`
2. Ensure there's a page with a linked Button (or create one via cmd+K)
3. Switch to hammer mode (click hammer icon)
4. Verify Button has blue ring and link icon
5. Click the Button - should navigate to linked page

## Files to Modify

1. **`src/app/atoms/(components)/(starter)/followup-prompts/registry.tsx`** (PRIMARY)
   - Add `Link` import from react-router-dom
   - Add `ArrowRight` to lucide-react imports
   - Add `LinkHighlight` wrapper component
   - Update `Button` component to use it when `linkTo` exists

2. **`src/app/atoms/(components)/(starter)/new-pages/actions.ts`** (OPTIONAL - for generated pages)
   - Same changes to `REGISTRY_CONTENT` string if we want generated pages to also show highlights

## Summary

This is a minimal change - we're just:
1. Adding a ~15 line wrapper component
2. Updating the Button render to conditionally wrap with it
3. No new state, no reading links.json, no new context providers
