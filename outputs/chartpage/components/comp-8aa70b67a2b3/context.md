# Component Spec: growth-card

## Overview
A container card component that houses the growth metric, providing visual grouping and contextual framing for the KPI data within the metrics dashboard.

## Purpose (Why)
- **User Need**: Users need metrics to be visually distinct and scannable when viewing multiple KPIs
- **Problem Solved**: Creates clear visual boundaries between different metrics, preventing data confusion
- **Product Vision**: Consistent card-based layout across the dashboard enables easy comparison and future extensibility (adding more cards)

## Definition (What)
### Features
- Card container with "Growth" title in header
- Contains single child: growth-metric component
- Consistent styling with sibling metric cards (revenue-card, users-card)
- Subtle shadow and border for visual elevation

### Behaviors
- Static container - no direct interactions
- Hover state: subtle elevation increase (shadow deepens)
- Click on card could expand to detailed view (future enhancement)
- Responsive: stacks vertically on narrow viewports

### Constraints
- Must maintain equal width with sibling cards in 3-column grid
- Title must be concise (single word preferred: "Growth", "Revenue", "Users")
- Card should not exceed reasonable height even with long metric values
- Must work within Grid parent with gap="md"

## Implementation (How)
### Data Requirements
- `title`: "Growth" (static string)
- Children: growth-metric element key reference
- No direct data - delegates to child metric component

### Interactions
- Container receives no direct events
- Events bubble up from child metric component
- Future: onClick handler for drill-down navigation

### Technical Notes
- Uses json-render Card component from shadcn/ui wrapper
- Renders CardHeader with title, CardContent with children
- Part of metrics-grid Grid layout with columns=3
- Siblings: revenue-card, users-card (ensure visual consistency)

## Open Questions
- Should cards support description subtitle under title?
- Consider adding actions menu (three-dot) in card header
- Evaluate skeleton loading state for async data
- Should empty state show placeholder or hide entire card?
