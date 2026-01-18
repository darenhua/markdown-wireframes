# Component Spec: growth-metric

## Overview
A key performance indicator (KPI) metric displaying month-over-month growth percentage with trend visualization, helping users quickly assess business trajectory.

## Purpose (Why)
- **User Need**: Stakeholders need at-a-glance understanding of growth trends without diving into detailed reports
- **Problem Solved**: Condenses complex growth data into a single, scannable metric with directional context
- **Product Vision**: Part of the metrics dashboard trifecta (Revenue, Users, Growth) providing holistic business health view

## Definition (What)
### Features
- Primary value display: "23.5%" - the month-over-month growth rate
- Label text: "Month-over-Month" describing what the metric represents
- Change indicator: "+5.1%" showing delta from previous period
- Trend direction: "up" with corresponding visual indicator (green color, up arrow)

### Behaviors
- Value updates in real-time when data refreshes
- Trend indicator changes color based on direction (green=up, red=down, gray=neutral)
- Hover state could reveal additional context (tooltip with historical data)
- Click could navigate to detailed growth analytics view

### Constraints
- Value must be formatted as percentage with one decimal place
- Change value must include +/- prefix for clarity
- Trend must be one of: "up", "down", "neutral"
- Should handle edge cases: negative growth, zero change, missing data

## Implementation (How)
### Data Requirements
- `label`: "Month-over-Month" (string)
- `value`: "23.5%" (formatted string or number to format)
- `change`: "+5.1%" (formatted string showing period delta)
- `trend`: "up" | "down" | "neutral"
- Data source: Analytics API or aggregated database query

### Interactions
- Optional: `onClick` to navigate to detailed growth view
- Optional: `onHover` to show tooltip with breakdown
- Auto-refresh: component may poll or subscribe to real-time updates

### Technical Notes
- Uses json-render Metric component from registry
- Trend color mapping: up=green-600, down=destructive, neutral=muted-foreground
- Arrow icons rendered conditionally based on trend value
- Number formatting should use locale-appropriate separators

## Open Questions
- Should we add sparkline mini-chart showing trend over time?
- Consider adding goal/target indicator (e.g., "Target: 25%")
- Evaluate adding period selector (weekly, monthly, quarterly)
- Should negative growth use "down" trend or show as red "up" with negative value?
