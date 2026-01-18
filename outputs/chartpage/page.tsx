"use client";

import { RenderCard, RenderGrid, RenderHeading, RenderMetric, RenderStack } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderStack direction="vertical" gap="lg">
      <RenderHeading text="Metrics Dashboard" level="1" />
      <RenderGrid columns={4} gap="md">
        <RenderCard title="Revenue">
          <RenderMetric label="Total Revenue" value="$124,580" change="+12.5%" trend="up" />
        </RenderCard>
        <RenderCard title="Users">
          <RenderMetric label="Active Users" value="8,240" change="+8.2%" trend="up" />
        </RenderCard>
        <RenderCard title="Growth">
          <RenderMetric label="Month-over-Month" value="23.5%" change="+5.1%" trend="up" />
        </RenderCard>
        <RenderCard title="Conversion">
          <RenderMetric label="Conversion Rate" value="3.24%" change="+0.8%" trend="up" />
        </RenderCard>
        <RenderCard title="Retention">
          <RenderMetric label="30-Day Retention" value="67.8%" change="-2.3%" trend="down" />
        </RenderCard>
        <RenderCard title="Engagement">
          <RenderMetric label="Avg Session Time" value="4m 32s" change="+18.5%" trend="up" />
        </RenderCard>
        <RenderCard title="Churn">
          <RenderMetric label="Monthly Churn" value="2.1%" change="-0.3%" trend="up" />
        </RenderCard>
        <RenderCard title="ROI">
          <RenderMetric label="Return on Investment" value="340%" change="+45%" trend="up" />
        </RenderCard>
      </RenderGrid>
    </RenderStack>
      </div>
    </div>
  );
}
