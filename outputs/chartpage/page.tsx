"use client";

import { RenderCard, RenderGrid, RenderHeading, RenderMetric, RenderStack } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4">
    <RenderStack direction="vertical" gap="lg">
      <RenderHeading text="Metrics Dashboard" level="1" />
      <RenderGrid columns={3} gap="md">
        <RenderCard title="Revenue">
          <RenderMetric label="Total Revenue" value="$124,580" change="+12.5%" trend="up" />
        </RenderCard>
        <RenderCard title="Users">
          <RenderMetric label="Active Users" value="8,240" change="+8.2%" trend="up" />
        </RenderCard>
        <RenderCard title="Growth">
          <RenderMetric label="Month-over-Month" value="23.5%" change="+5.1%" trend="up" />
        </RenderCard>
      </RenderGrid>
    </RenderStack>
      </div>
    </div>
  );
}
