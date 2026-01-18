"use client";

import {
  FolderOpen,
  Hammer,
  MousePointer2,
  NotebookPen,
  Sparkles,
  Mic,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActivePanel = "pointer" | "ai" | "notes" | "tools" | "files";

// Speech states for the voice feature
type SpeechState = "idle" | "recording" | "processing" | "speaking";

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

// ElevenLabs TTS function
async function textToSpeech(text: string): Promise<void> {
  const response = await fetch("/api/elevenlabs/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate speech");
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error("Audio playback failed"));
    };
    audio.play();
  });
}

export default function FloatingBarPage() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const isKeyHeldRef = useRef(false);

  // Process speech: STT mock -> TTS via ElevenLabs
  const processSpeech = useCallback(async () => {
    // Transition to processing state
    setSpeechState("processing");

    // Mock STT processing (300ms as requested)
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Transition to speaking state
    setSpeechState("speaking");

    // TTS with lorem ipsum via ElevenLabs
    const loremIpsum =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

    try {
      await textToSpeech(loremIpsum);
    } catch (error) {
      console.error("TTS error:", error);
    }

    // Back to idle
    setSpeechState("idle");
  }, []);

  // Handle keydown - start recording when 'v' is pressed
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.key === "v" || e.key === "V") && !e.repeat) {
        // Only start recording if we're idle
        if (speechState === "idle" && !isKeyHeldRef.current) {
          isKeyHeldRef.current = true;
          setSpeechState("recording");
        }
      }
    },
    [speechState]
  );

  // Handle keyup - stop recording and process when 'v' is released
  const handleKeyUp = useCallback(
    async (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") {
        if (speechState === "recording" && isKeyHeldRef.current) {
          isKeyHeldRef.current = false;
          await processSpeech();
        }
      }
    },
    [speechState, processSpeech]
  );

  // Set up keyboard event listeners
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Get aura styles based on speech state (desaturated colors)
  const getAuraStyles = () => {
    switch (speechState) {
      case "recording":
        // Desaturated amber/orange
        return "shadow-[0_0_30px_10px_rgba(200,160,100,0.6),0_0_60px_20px_rgba(200,160,100,0.35),0_0_90px_30px_rgba(200,160,100,0.15)]";
      case "processing":
        // Desaturated dusty rose/red
        return "shadow-[0_0_15px_5px_rgba(180,110,110,0.5),0_0_30px_10px_rgba(180,110,110,0.25)]";
      case "speaking":
        // Desaturated sage green
        return "shadow-[0_0_15px_5px_rgba(120,160,130,0.5),0_0_30px_10px_rgba(120,160,130,0.25)]";
      default:
        return "";
    }
  };

  // Get state indicator for the panel
  const getStateIndicator = () => {
    switch (speechState) {
      case "recording":
        return (
          <div className="flex items-center gap-2 text-amber-600">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500"></span>
            </span>
            <span className="text-sm font-medium">Recording...</span>
          </div>
        );
      case "processing":
        return (
          <div className="flex items-center gap-2 text-rose-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-400 border-t-transparent"></span>
            <span className="text-sm font-medium">Processing...</span>
          </div>
        );
      case "speaking":
        return (
          <div className="flex items-center gap-2 text-emerald-600">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium">Speaking...</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="h-3 w-3 rounded-full bg-muted-foreground/30"></span>
            <span className="text-sm">Ready</span>
          </div>
        );
    }
  };

  // Handle button click to simulate holding 'v'
  const handleSpeakButtonDown = useCallback(() => {
    if (speechState === "idle") {
      isKeyHeldRef.current = true;
      setSpeechState("recording");
    }
  }, [speechState]);

  const handleSpeakButtonUp = useCallback(async () => {
    if (speechState === "recording" && isKeyHeldRef.current) {
      isKeyHeldRef.current = false;
      await processSpeech();
    }
  }, [speechState, processSpeech]);

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
        <div className="fixed bottom-3 right-2 z-30 flex w-72 flex-col rounded-lg border bg-gray-100 p-4 shadow-lg">
          <h3 className="font-semibold">{panelNames[activePanel]}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {panelDescriptions[activePanel]}
          </p>

          {/* Speak button section */}
          <div className="mt-4 border-t pt-4">
            <div className="mb-3">{getStateIndicator()}</div>

            <Button
              variant={speechState === "recording" ? "default" : "outline"}
              className={cn(
                "w-full gap-2 transition-all",
                speechState === "recording" &&
                  "bg-amber-500 hover:bg-amber-600",
                speechState !== "idle" &&
                  speechState !== "recording" &&
                  "opacity-50 cursor-not-allowed"
              )}
              onMouseDown={handleSpeakButtonDown}
              onMouseUp={handleSpeakButtonUp}
              onMouseLeave={() => {
                // If mouse leaves while held, treat as release
                if (speechState === "recording") {
                  handleSpeakButtonUp();
                }
              }}
              disabled={speechState !== "idle" && speechState !== "recording"}
            >
              <Mic className="h-4 w-4" />
              {speechState === "recording" ? "Release to send" : "Hold to speak"}
            </Button>

            <p className="mt-2 text-center text-xs text-muted-foreground">
              Or hold <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">V</kbd> key
            </p>
          </div>
        </div>
      )}

      {/* Floating bar at bottom with aura effect */}
      <div
        className={cn(
          "fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm transition-shadow duration-300",
          getAuraStyles()
        )}
      >
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
