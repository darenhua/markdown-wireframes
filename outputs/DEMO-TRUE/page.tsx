"use client";

import { RenderAvatar, RenderBox, RenderButton, RenderCard, RenderGrid, RenderHeading, RenderList, RenderMetric, RenderStack, RenderTabs, RenderTabsContent, RenderTabsList, RenderTabsTrigger, RenderText } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
    <RenderBox padding="lg">
      <RenderStack direction="horizontal" align="center" gap="md">
        <RenderHeading text="Social Media Dashboard" level="1" />
        <RenderStack direction="horizontal" gap="sm">
          <RenderButton label="Refresh" variant="secondary" />
          <RenderButton label="Settings" variant="outline" />
        </RenderStack>
      </RenderStack>
      <RenderStack direction="vertical" gap="lg">
        <RenderCard title="Performance Metrics">
          <RenderGrid columns={4} gap="md">
            <RenderMetric label="Total Followers" value="24,580" change="+12%" trend="up" />
            <RenderMetric label="Engagement Rate" value="4.8%" change="+0.5%" trend="up" />
            <RenderMetric label="Total Reach" value="156,200" change="+8%" trend="up" />
            <RenderMetric label="Impressions" value="342,100" change="-2%" trend="down" />
          </RenderGrid>
        </RenderCard>
        <RenderGrid columns={3} gap="lg">
          <RenderCard title="Profile">
            <RenderStack direction="vertical" gap="md" align="center">
              <RenderAvatar src="https://example.com/avatar.jpg" fallback="U" alt="User Avatar" />
              <RenderHeading text="John Doe" level="2" />
            </RenderStack>
          </RenderCard>
          <RenderCard title="Key Insights">
            <RenderStack direction="vertical" gap="md">
              <RenderMetric label="Followers" value="10.5k" change="+12%" trend="up" />
              <RenderMetric label="Likes" value="23.1k" change="+5%" trend="up" />
              <RenderMetric label="Comments" value="5.2k" change="+8%" trend="up" />
            </RenderStack>
          </RenderCard>
          <RenderCard title="Engagement">
            <RenderStack direction="vertical" gap="md">
              <RenderMetric label="Shares" value="2.8k" change="+2%" trend="up" />
              <RenderMetric label="Saves" value="1.5k" change="-1%" trend="down" />
              <RenderText text="Age: 18-34, 60% Female" />
            </RenderStack>
          </RenderCard>
          <RenderCard title="Recent Posts">
            <RenderStack direction="vertical" gap="md">
              <RenderText text="Post 1: Image of sunset" variant="default" size="base" />
              <RenderText text="Post 2: Announcement of new product" variant="default" size="base" />
              <RenderText text="Post 3: Question about favorite features" variant="default" size="base" />
            </RenderStack>
          </RenderCard>
          <RenderCard title="Notifications">
            <RenderList items={["User4 liked your post","User5 started following you"]} ordered={false} />
          </RenderCard>
          <RenderTabs defaultValue="twitter">
            <RenderTabsList>
              <RenderTabsTrigger value="twitter" label="Twitter" />
              <RenderTabsTrigger value="instagram" label="Instagram" />
              <RenderTabsTrigger value="linkedin" label="LinkedIn" />
            </RenderTabsList>
            <RenderTabsContent value="twitter">
              <RenderStack direction="vertical" gap="md">
                <RenderMetric label="Tweets" value="342" change="+15" trend="up" />
                <RenderMetric label="Retweets" value="1,245" change="+89" trend="up" />
              </RenderStack>
            </RenderTabsContent>
            <RenderTabsContent value="instagram">
              <RenderStack direction="vertical" gap="md">
                <RenderMetric label="Posts" value="128" change="+8" trend="up" />
                <RenderMetric label="Likes" value="12,450" change="+890" trend="up" />
              </RenderStack>
            </RenderTabsContent>
            <RenderTabsContent value="linkedin">
              <RenderStack direction="vertical" gap="md">
                <RenderMetric label="Posts" value="45" change="+3" trend="up" />
                <RenderMetric label="Engagements" value="892" change="+156" trend="up" />
              </RenderStack>
            </RenderTabsContent>
          </RenderTabs>
        </RenderGrid>
      </RenderStack>
    </RenderBox>
      </div>
    </div>
  );
}
