"use client";

import { Renderer, DataProvider, VisibilityProvider, ActionProvider } from "@json-render/react";
import type { UITree } from "@json-render/core";
import { registry } from "@/app/atoms/(components)/(starter)/try-jsonrender/registry";

const tree: UITree = {
    "root": "welcome-card",
    "elements": {
      "welcome-card": {
        "key": "welcome-card",
        "type": "Card",
        "props": {
          "title": "Welcome",
          "bg": "gradient-warm"
        },
        "children": [
          "heart-icon",
          "sparkles-icon",
          "welcome-text",
          "get-started-btn"
        ]
      },
      "sparkles-icon": {
        "key": "sparkles-icon",
        "type": "Icon",
        "props": {
          "name": "sparkles",
          "size": "lg",
          "color": "purple"
        }
      },
      "welcome-text": {
        "key": "welcome-text",
        "type": "Text",
        "props": {
          "text": "Hello! Welcome to our app.",
          "size": "lg",
          "color": "purple"
        }
      },
      "get-started-btn": {
        "key": "get-started-btn",
        "type": "Button",
        "props": {
          "label": "Get Started",
          "variant": "primary",
          "linkTo": "/link"
        }
      },
      "heart-icon": {
        "key": "heart-icon",
        "type": "Icon",
        "props": {
          "name": "heart",
          "size": "md",
          "color": "pink"
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
