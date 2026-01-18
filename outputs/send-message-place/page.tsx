"use client";

import { RenderButton, RenderStack } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderStack direction="vertical" gap="lg">
      <RenderButton label="Submit" variant="default" />
    </RenderStack>
      </div>
    </div>
  );
}
