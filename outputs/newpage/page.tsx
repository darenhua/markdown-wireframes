"use client";

import { RenderCard, RenderGrid, RenderHeading, RenderMetric, RenderStack } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderStack direction="vertical" gap="lg">
      <RenderHeading text="Key Metrics" level="1" />
      <RenderGrid columns={3} gap="md">
        <RenderCard title="Revenue">
          <RenderMetric label="Total Revenue" value="$125,430" change="+12.5%" trend="up" />
        </RenderCard>
        <RenderCard title="Users">
          <RenderMetric label="Active Users" value="8,942" change="+5.2%" trend="up" />
        </RenderCard>
        <RenderCard title="Growth">
          <RenderMetric label="Monthly Growth" value="23.8%" change="-2.1%" trend="down" />
        </RenderCard>
      </RenderGrid>
    </RenderStack>
      </div>
    </div>
  );
}
