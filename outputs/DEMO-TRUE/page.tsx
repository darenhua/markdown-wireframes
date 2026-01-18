"use client";

import { RenderBadge, RenderBox, RenderCard, RenderGrid, RenderHeading, RenderIcon, RenderStack, RenderText } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderCard title="Metrics Dashboard" description="Key performance indicators and growth statistics">
      <RenderStack direction="vertical" gap="lg">
        <RenderGrid columns={3} gap="md">
          <RenderBox padding="md" rounded="md" border shadow="sm">
            <RenderText text="Total Revenue" variant="muted" size="sm" />
            <RenderHeading text="$124,580" level="2" />
            <RenderStack direction="horizontal" gap="sm" align="center">
              <RenderIcon name="arrow-right" size="sm" />
              <RenderText text="+12.5% from last month" variant="success" size="sm" />
            </RenderStack>
          </RenderBox>
          <RenderBox padding="md" rounded="md" border shadow="sm">
            <RenderText text="Active Users" variant="muted" size="sm" />
            <RenderHeading text="8,234" level="2" />
            <RenderStack direction="horizontal" gap="sm" align="center">
              <RenderIcon name="arrow-right" size="sm" />
              <RenderText text="+8.2% from last month" variant="success" size="sm" />
            </RenderStack>
          </RenderBox>
          <RenderBox padding="md" rounded="md" border shadow="sm">
            <RenderText text="Conversion Rate" variant="muted" size="sm" />
            <RenderHeading text="3.24%" level="2" />
            <RenderStack direction="horizontal" gap="sm" align="center">
              <RenderIcon name="arrow-left" size="sm" />
              <RenderText text="-2.1% from last month" variant="error" size="sm" />
            </RenderStack>
          </RenderBox>
        </RenderGrid>
        <RenderStack direction="vertical" gap="md">
          <RenderHeading text="Growth Metrics" level="3" />
          <RenderGrid columns={2} gap="md">
            <RenderBox padding="md" rounded="md" border shadow="sm">
              <RenderText text="Monthly Recurring Revenue" variant="muted" size="sm" />
              <RenderHeading text="$42,150" level="2" />
              <RenderBadge text="Growing" variant="default" />
            </RenderBox>
            <RenderBox padding="md" rounded="md" border shadow="sm">
              <RenderText text="Churn Rate" variant="muted" size="sm" />
              <RenderHeading text="2.15%" level="2" />
              <RenderBadge text="Stable" variant="secondary" />
            </RenderBox>
          </RenderGrid>
        </RenderStack>
      </RenderStack>
    </RenderCard>
      </div>
    </div>
  );
}
