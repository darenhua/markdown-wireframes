# Component Spec: Title

## Overview
The root-level title heading element that establishes the primary identity and hierarchy of the page content.

## Purpose (Why)
- **User Need**: Users need immediate context about what page/section they're viewing
- **Problem Solved**: Eliminates confusion about location within the app, provides semantic structure for screen readers
- **Product Vision**: Consistent title treatment across all pages creates a unified, professional experience

## Definition (What)
### Features
- Large, prominent heading at h2 level
- Positioned as first content element in visual hierarchy
- Supports optional companion elements (icons, badges, breadcrumbs)
- Semantic HTML heading for accessibility and SEO

### Behaviors
- Static display - no interactive states by default
- When linked: gains hover/focus states for navigation
- Responsive sizing: scales down gracefully on mobile viewports

### Constraints
- Maximum 50 characters to prevent wrapping on most viewports
- Must be unique per page for accessibility (one h1 equivalent per page)
- Should not contain interactive elements other than navigation links
- Must maintain sufficient color contrast (WCAG AA minimum)

## Implementation (How)
### Data Requirements
- Text content: can be static or dynamically loaded from page metadata
- Optional: linkTo destination for navigation-enabled titles

### Interactions
- When static: no interactions
- When linked: standard link behaviors (click, keyboard enter, focus)

### Technical Notes
- Uses json-render Heading component
- Level prop determines rendered HTML tag (h1-h4)
- Styling controlled via Tailwind typography classes
- Part of title-with-heart composite when paired with icon

## Open Questions
- Should titles support rich text (bold, italic)?
- Consider adding subtitle support for longer descriptive text
- Evaluate animation on page transitions
