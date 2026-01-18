"use client";

import { RenderButton, RenderCard, RenderHeading, RenderIcon, RenderInput, RenderSeparator, RenderStack, RenderTextarea } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderCard title="Contact Us" description="Send us a message and we'll get back to you soon." style={{"background":"linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)"}}>
      <RenderStack direction="horizontal" gap="sm" align="center">
        <RenderIcon name="heart" size="md" />
        <RenderHeading text="Contact Us" level="2" />
      </RenderStack>
      <RenderStack direction="vertical" gap="lg">
        <RenderStack direction="vertical" gap="md">
          <RenderInput label="Name" placeholder="Your full name" type="text" />
          <RenderInput label="Email" placeholder="your@email.com" type="email" />
          <RenderTextarea label="Message" placeholder="Tell us what's on your mind..." rows={5} />
          <RenderStack direction="horizontal" gap="sm">
            <RenderButton label="Send Message" variant="default" linkTo="/send-message-place" />
            <RenderButton label="Cancel" variant="outline" />
            <RenderButton label="Save Draft" variant="outline" />
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
