"use client";

import { RenderButton, RenderCard, RenderInput, RenderStack, RenderTextarea } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderCard title="Contact Us" description="Send us a message and we'll get back to you soon.">
      <RenderStack direction="vertical" gap="md">
        <RenderInput label="Name" placeholder="Your full name" type="text" />
        <RenderInput label="Email" placeholder="your.email@example.com" type="email" />
        <RenderTextarea label="Message" placeholder="Tell us what's on your mind..." rows={5} />
        <RenderStack direction="horizontal" gap="sm">
          <RenderButton label="Send Message" variant="default" />
          <RenderButton label="Cancel" variant="outline" />
        </RenderStack>
      </RenderStack>
    </RenderCard>
      </div>
    </div>
  );
}
