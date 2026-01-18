"use client";

import { RenderBox, RenderButton, RenderCard, RenderGrid, RenderHeading, RenderIcon, RenderMetric, RenderStack, RenderText } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderStack direction="horizontal" gap="sm" align="center">
      <RenderIcon name="heart" size="md" />
      <RenderHeading text="Title" level="2" linkTo="/DEMO" />
    </RenderStack>
      </div>
    </div>
  );
}
