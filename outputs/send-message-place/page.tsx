"use client";

import { RenderBadge, RenderCard, RenderGrid, RenderHeading, RenderMetric, RenderStack, RenderText } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderStack direction="vertical" gap="lg">
      <RenderHeading text="Contact Form Dashboard" level="1" />
      <RenderGrid columns={4} gap="md">
        <RenderCard>
          <RenderMetric label="Total Contacts" value="1,284" change="+12%" trend="up" />
        </RenderCard>
        <RenderCard>
          <RenderMetric label="This Week" value="142" change="+8%" trend="up" />
        </RenderCard>
        <RenderCard>
          <RenderMetric label="Pending Follow-up" value="23" change="-5%" trend="down" />
        </RenderCard>
        <RenderCard>
          <RenderMetric label="Conversion Rate" value="18.5%" change="+2.3%" trend="up" />
        </RenderCard>
      </RenderGrid>
      <RenderCard title="Recent Submissions" description="Last 5 contact form submissions">
        <RenderStack direction="vertical" gap="sm">
          <RenderStack direction="horizontal" gap="md" align="center">
            <RenderText text="Sarah Johnson" size="base" />
            <RenderText text="sarah.j@example.com" variant="muted" size="sm" />
            <RenderBadge text="Responded" variant="secondary" />
          </RenderStack>
          <RenderStack direction="horizontal" gap="md" align="center">
            <RenderText text="Michael Chen" size="base" />
            <RenderText text="m.chen@example.com" variant="muted" size="sm" />
            <RenderBadge text="Pending" variant="outline" />
          </RenderStack>
          <RenderStack direction="horizontal" gap="md" align="center">
            <RenderText text="Emily Rodriguez" size="base" />
            <RenderText text="emily.r@example.com" variant="muted" size="sm" />
            <RenderBadge text="Responded" variant="secondary" />
          </RenderStack>
          <RenderStack direction="horizontal" gap="md" align="center">
            <RenderText text="David Park" size="base" />
            <RenderText text="d.park@example.com" variant="muted" size="sm" />
            <RenderBadge text="Pending" variant="outline" />
          </RenderStack>
          <RenderStack direction="horizontal" gap="md" align="center">
            <RenderText text="Jessica Liu" size="base" />
            <RenderText text="j.liu@example.com" variant="muted" size="sm" />
            <RenderBadge text="Responded" variant="secondary" />
          </RenderStack>
        </RenderStack>
      </RenderCard>
    </RenderStack>
      </div>
    </div>
  );
}
