"use client";

import { Renderer, DataProvider, VisibilityProvider, ActionProvider } from "@json-render/react";
import type { UITree } from "@json-render/core";
import { registry } from "./registry";

const tree: UITree = {
    "root": "metrics-dashboard",
    "elements": {
      "metrics-dashboard": {
        "key": "metrics-dashboard",
        "type": "Stack",
        "props": {
          "direction": "vertical",
          "gap": "lg",
          "align": "center"
        },
        "children": [
          "revenue-metric",
          "users-metric",
          "growth-metric"
        ]
      },
      "revenue-metric": {
        "key": "revenue-metric",
        "type": "Metric",
        "props": {
          "label": "Revenue",
          "value": "$120,000",
          "change": "15%",
          "trend": "up"
        }
      },
      "users-metric": {
        "key": "users-metric",
        "type": "Metric",
        "props": {
          "label": "Users",
          "value": "8,500",
          "change": "5%",
          "trend": "up"
        }
      },
      "growth-metric": {
        "key": "growth-metric",
        "type": "Metric",
        "props": {
          "label": "Growth",
          "value": "7%",
          "change": "2%",
          "trend": "up"
        }
      }
    }
  };

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <DataProvider>
        <VisibilityProvider>
          <ActionProvider>
            <div className="space-y-4">
              <Renderer tree={tree} registry={registry} />
            </div>
          </ActionProvider>
        </VisibilityProvider>
      </DataProvider>
    </div>
  );
}
