"use client";

import { RenderBox, RenderButton, RenderCard, RenderStack, RenderText } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderBox padding="lg" align="center">
      <RenderCard title="Welcome!" description="We're glad you're here!">
        <RenderStack direction="vertical" gap="md" align="center">
          <RenderText text="We're excited to have you here. Let's get you started on your journey!" size="base" />
          <RenderButton label="Get Started" variant="default" size="default" />
        </RenderStack>
      </RenderCard>
    </RenderBox>
      </div>
    </div>
  );
}
