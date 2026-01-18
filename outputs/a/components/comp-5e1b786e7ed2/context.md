# Component Spec: secondary-btn

## Overview
An outline-style cancel button used for dismissive actions, allowing users to back out of operations without committing changes.

## Purpose (Why)
- **User Need**: Users need a clear, low-commitment way to exit flows, close modals, or abandon form submissions
- **Problem Solved**: Reduces user anxiety by providing an obvious escape route, preventing accidental data loss
- **Product Vision**: Maintains consistent action patterns across the app - destructive/primary actions get solid buttons, dismissive actions get outline style

## Definition (What)
### Features
- Displays "Cancel" label text
- Uses outline variant (bordered, transparent background)
- Default size matching primary action buttons
- Visually subordinate to primary actions while remaining clearly clickable

### Behaviors
- On hover: background fills with subtle gray, border darkens slightly
- On click: triggers dismissal callback (close modal, reset form, navigate back)
- On focus: visible focus ring for accessibility
- Disabled state: reduced opacity, no hover effects, cursor not-allowed

### Constraints
- Must always be paired with a primary action button (never standalone)
- Should be positioned to the left of primary/destructive actions
- Label should be contextual when possible ("Cancel", "Discard", "Go Back")
- Minimum width to prevent text truncation

## Implementation (How)
### Data Requirements
- Static label: "Cancel"
- No data fetching - purely presentational with callback

### Interactions
- `onClick`: Execute provided onCancel callback
- Callback typically: closes modal, resets form state, navigates to previous route
- Should not trigger form submission

### Technical Notes
- Uses shadcn/ui Button component with `variant="outline"`
- Rendered via json-render Button registry entry
- Size prop set to "default" for consistent height with sibling buttons

## Open Questions
- Should we add confirmation for cancel if form has unsaved changes?
- Consider keyboard shortcut (Escape key) binding at parent level
- Evaluate adding subtle animation on state changes
