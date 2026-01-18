# Component Spec: title-text

## Overview
A clickable heading component that serves as the primary navigation title, linking users to the demo page while communicating the page identity.

## Purpose (Why)
- **User Need**: Users need a clear, recognizable way to identify the current page and navigate to key areas of the application
- **Problem Solved**: Provides brand consistency and intuitive wayfinding without cluttering the interface
- **Product Vision**: Acts as the anchor point for the page hierarchy, establishing visual hierarchy while serving double-duty as navigation

## Definition (What)
### Features
- Displays "Title" text at heading level 2 (h2)
- Functions as a clickable link to "/DEMO" route
- Positioned inline with a heart icon in a horizontal stack
- Medium-weight typography for visual prominence

### Behaviors
- On hover: cursor changes to pointer, subtle color shift to indicate interactivity
- On click: navigates to /DEMO route via client-side routing
- Maintains focus states for keyboard accessibility

### Constraints
- Text should not wrap to multiple lines
- Must maintain minimum touch target of 44x44px for mobile
- Link should work with both mouse and keyboard navigation
- Should not trigger navigation on middle-click (open in new tab behavior preserved)

## Implementation (How)
### Data Requirements
- Static text content: "Title"
- Static link destination: "/DEMO"
- No dynamic data fetching required

### Interactions
- `onClick`: Navigate to /DEMO using React Router
- `onKeyDown (Enter)`: Trigger same navigation as click
- Hover state managed via CSS

### Technical Notes
- Uses json-render Heading component with `linkTo` prop extension
- Rendered within a Stack component with horizontal direction
- Part of the title-with-heart composite element

## Open Questions
- Should the title text be configurable per-page or remain static?
- Consider adding breadcrumb context for deeper page hierarchies
- Evaluate whether heart icon should also be clickable as part of the link
