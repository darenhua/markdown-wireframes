"use client";

import { FolderOpen, Hammer, MousePointer2, NotebookPen, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type ActivePanel = "pointer" | "ai" | "notes" | "tools" | "files";

const panelNames: Record<ActivePanel, string> = {
  pointer: "Select",
  ai: "AI Assist",
  notes: "Notes",
  tools: "Tools",
  files: "Files",
};

const panelDescriptions: Record<ActivePanel, string> = {
  pointer: "Click to select elements on the canvas",
  ai: "Get AI-powered suggestions and assistance",
  notes: "Write and organize your notes",
  tools: "Access build and development tools",
  files: "Browse and manage your project files",
};

export default function FloatingBarPage() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");

  return (
    <div className="relative h-screen p-4 pb-8">
      {/* Main content area */}
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted-foreground">
        <span className="text-2xl font-medium text-background">
          {panelNames[activePanel]}
        </span>
      </div>

      {/* Floating panel bottom right */}
      {activePanel !== "pointer" && (
        <div className="fixed bottom-3 right-2 z-30 flex h-80 w-72 flex-col rounded-lg border bg-gray-100 p-4 shadow-lg">
          <h3 className="font-semibold">{panelNames[activePanel]}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {panelDescriptions[activePanel]}
          </p>
        </div>
      )}

      {/* Floating bar at bottom */}
      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm">
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("pointer")}
          size="icon"
          variant={activePanel === "pointer" ? "default" : "ghost"}
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("ai")}
          size="icon"
          variant={activePanel === "ai" ? "default" : "ghost"}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("notes")}
          size="icon"
          variant={activePanel === "notes" ? "default" : "ghost"}
        >
          <NotebookPen className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("tools")}
          size="icon"
          variant={activePanel === "tools" ? "default" : "ghost"}
        >
          <Hammer className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("files")}
          size="icon"
          variant={activePanel === "files" ? "default" : "ghost"}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
