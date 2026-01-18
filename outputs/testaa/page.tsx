"use client";

import { Renderer, DataProvider, VisibilityProvider, ActionProvider } from "@json-render/react";
import type { UITree } from "@json-render/core";
import { registry } from "./registry";

const tree: UITree = {
    "root": "welcome-card",
    "elements": {
      "welcome-card": {
        "key": "welcome-card",
        "type": "Card",
        "props": {
          "title": "Welcome",
          "description": "Get started with our app",
          "bg": "gradient-warm"
        },
        "children": [
          "sparkles-icon",
          "greeting-text",
          "start-btn"
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
      "greeting-text": {
        "key": "greeting-text",
        "type": "Text",
        "props": {
          "text": "Hello! Welcome to our app.",
          "variant": "default",
          "size": "lg",
          "color": "purple",
          "align": "center"
        }
      },
      "start-btn": {
        "key": "start-btn",
        "type": "Button",
        "props": {
          "label": "Get Started",
          "variant": "primary"
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
