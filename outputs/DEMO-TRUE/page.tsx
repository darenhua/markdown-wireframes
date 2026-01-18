"use client";

import { RenderButton, RenderCard, RenderHeading, RenderInput, RenderSeparator, RenderStack, RenderTextarea } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderCard title="Contact Us" description="Send us a message and we'll get back to you soon.">
      <RenderStack direction="vertical" gap="lg">
        <RenderStack direction="vertical" gap="md">
          <RenderInput label="Name" placeholder="Your full name" type="text" />
          <RenderInput label="Email" placeholder="your@email.com" type="email" />
          <RenderTextarea label="Message" placeholder="Tell us what's on your mind..." rows={5} />
          <RenderStack direction="horizontal" gap="sm">
            <RenderButton label="Send Message" variant="default" linkTo="/send-message-place" />
            <RenderButton label="Cancel" variant="outline" />
          </RenderStack>
        </RenderStack>
        <RenderSeparator orientation="horizontal" />
        <RenderStack direction="vertical" gap="md">
          <RenderHeading text="Feedback Form" level="3" />
          <RenderInput label="Name" placeholder="Your full name" type="text" />
          <RenderInput label="Email" placeholder="your@email.com" type="email" />
          <RenderTextarea label="Feedback" placeholder="Share your feedback..." rows={4} />
          <RenderStack direction="horizontal" gap="sm">
            <RenderButton label="Submit Feedback" variant="default" />
            <RenderButton label="Cancel" variant="outline" />
          </RenderStack>
        </RenderStack>
      </RenderStack>
    </RenderCard>
      </div>
    </div>
  );
}
