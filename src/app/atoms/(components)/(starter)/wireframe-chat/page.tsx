"use client";

import {
  FolderOpen,
  Hammer,
  MousePointer2,
  NotebookPen,
  Sparkles,
} from "lucide-react";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Renderer,
  DataProvider,
  VisibilityProvider,
  ActionProvider,
} from "@json-render/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { registry } from "../try-jsonrender/registry";

interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionResultItem;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEventLocal extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEventLocal extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionLocal {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLocal) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLocal) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionLocal;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const EXAMPLE_PROMPTS = [
  "Create a welcome card with a greeting and get started button",
  "Build a metrics dashboard with revenue, users, and growth stats",
  "Design a contact form with name, email, and message fields",
  "Create a pricing card with features list and subscribe button",
];

type ActivePanel = "pointer" | "ai" | "notes" | "tools" | "files";

const panelIconMap: Record<ActivePanel, ReactNode> = {
  pointer: <MousePointer2 className="h-4 w-4" />,
  ai: <Sparkles className="h-4 w-4" />,
  notes: <NotebookPen className="h-4 w-4" />,
  tools: <Hammer className="h-4 w-4" />,
  files: <FolderOpen className="h-4 w-4" />,
};

type SpeechState = "idle" | "recording" | "processing" | "speaking";

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens?: TokenUsage;
};

type UITree = {
  root: string | null;
  elements: Record<string, unknown>;
};

type GenerationMode = "standard" | "ensemble";
type PreviewSource = "merged" | "A" | "B" | "C";

type EnsembleMetadata = {
  timing: {
    generatorsMs: number;
    evaluatorMs: number;
    totalMs: number;
  };
  generators: {
    A: { model: string; outputLength: number; usage: TokenUsage | null };
    B: { model: string; outputLength: number; usage: TokenUsage | null };
    C: { model: string; outputLength: number; usage: TokenUsage | null };
  };
  evaluator: { model: string; usage: TokenUsage | null };
};

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

// Parse AI response to extract JSON and chat sections
// Format: JSON patches first, then "---", then chat text
function parseResponse(text: string): { chat: string; json: string } {
  if (!text) return { chat: "", json: "" };

  const parts = text.split("---");
  if (parts.length >= 2) {
    let jsonSection = parts[0].trim();
    const chatSection = parts.slice(1).join("---").trim();

    // Strip markdown code fences if present
    const codeBlockMatch = jsonSection.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonSection = codeBlockMatch[1].trim();
    }

    return { chat: chatSection, json: jsonSection };
  }

  // If no delimiter, check if it's all JSON or all chat
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    // Looks like JSON-only response
    return { chat: "", json: trimmed };
  }

  // Treat as chat-only
  return { chat: trimmed, json: "" };
}

// Apply JSONL patches to a tree
function applyPatches(tree: UITree, jsonl: string): UITree {
  if (!jsonl || !jsonl.trim()) return tree;

  // Clean up markdown code blocks that models sometimes add
  let cleaned = jsonl
    .replace(/```json\n?/g, "")
    .replace(/```jsonl\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const newTree = { ...tree, elements: { ...tree.elements } };
  const lines = cleaned.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    try {
      const patch = JSON.parse(line);
      if (patch.op === "set") {
        if (patch.path === "/root") {
          newTree.root = patch.value;
        } else if (patch.path.startsWith("/elements/")) {
          const key = patch.path.replace("/elements/", "");
          newTree.elements[key] = patch.value;
        }
      }
    } catch (e) {
      console.warn("Failed to parse patch:", line, e);
    }
  }

  return newTree;
}

export default function WireframeChatPage() {
  const [tree, setTree] = useState<UITree>({ root: null, elements: {} });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const isVoiceKeyHeldRef = useRef(false);
  const voicePromptIndexRef = useRef(-1);
  const recognitionRef = useRef<SpeechRecognitionLocal | null>(null);
  const getNextVoicePrompt = useCallback(() => {
    voicePromptIndexRef.current =
      (voicePromptIndexRef.current + 1) % EXAMPLE_PROMPTS.length;
    return EXAMPLE_PROMPTS[voicePromptIndexRef.current];
  }, []);

  // Ensemble mode state
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
  const [previewSource, setPreviewSource] = useState<PreviewSource>("merged");
  const [ensembleTrees, setEnsembleTrees] = useState<{
    merged: UITree;
    A: UITree;
    B: UITree;
    C: UITree;
  }>({
    merged: { root: null, elements: {} },
    A: { root: null, elements: {} },
    B: { root: null, elements: {} },
    C: { root: null, elements: {} },
  });
  const [ensembleMetadata, setEnsembleMetadata] = useState<EnsembleMetadata | null>(null);

  // Calculate cumulative token totals
  const totalTokens = messages.reduce(
    (acc, msg) => {
      if (msg.tokens) {
        acc.prompt += msg.tokens.promptTokens ?? 0;
        acc.completion += msg.tokens.completionTokens ?? 0;
        acc.total += msg.tokens.totalTokens ?? 0;
      }
      return acc;
    },
    { prompt: 0, completion: 0, total: 0 }
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      // Reset ensemble state when starting new generation
      if (generationMode === "ensemble") {
        setPreviewSource("merged");
        setEnsembleTrees({
          merged: { root: null, elements: {} },
          A: { root: null, elements: {} },
          B: { root: null, elements: {} },
          C: { root: null, elements: {} },
        });
        setEnsembleMetadata(null);
      }

      try {
        if (generationMode === "ensemble") {
          // Ensemble mode: Call ensemble-chat API (non-streaming)
          const response = await fetch("/api/ensemble-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: text,
              evaluatorVariant: "mergeStructured", // Use structured merge by default
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch response");
          }

          const data = await response.json();
          const assistantId = `assistant-${Date.now()}`;

          // Build trees for each output
          const emptyTree: UITree = { root: null, elements: {} };
          const newTrees = {
            merged: data.result ? applyPatches(emptyTree, data.result) : emptyTree,
            A: data.rawOutputs?.A ? applyPatches(emptyTree, data.rawOutputs.A) : emptyTree,
            B: data.rawOutputs?.B ? applyPatches(emptyTree, data.rawOutputs.B) : emptyTree,
            C: data.rawOutputs?.C ? applyPatches(emptyTree, data.rawOutputs.C) : emptyTree,
          };
          setEnsembleTrees(newTrees);
          setTree(newTrees.merged); // Set main tree to merged result
          setEnsembleMetadata(data.metadata);

          // Calculate total tokens for this call
          const totalEnsembleTokens =
            (data.metadata?.generators?.A?.usage?.totalTokens || 0) +
            (data.metadata?.generators?.B?.usage?.totalTokens || 0) +
            (data.metadata?.generators?.C?.usage?.totalTokens || 0) +
            (data.metadata?.evaluator?.usage?.totalTokens || 0);

          // Add assistant message
          setMessages((prev) => [
            ...prev,
            {
              id: assistantId,
              role: "assistant",
              content: `Generated UI from 3 models (${data.metadata?.timing?.totalMs}ms). Use the preview toggles to compare.`,
              tokens: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: totalEnsembleTokens,
              },
            },
          ]);
        } else {
          // Standard mode: Original streaming API call
          const response = await fetch("/api/json-render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "chat",
              messages: updatedMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              currentTree: tree,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch response");
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("No reader available");

          const decoder = new TextDecoder();
          let assistantContent = "";
          const assistantId = `assistant-${Date.now()}`;

          // Add empty assistant message that we'll update
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: "" },
          ]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            assistantContent += chunk;

            // Strip token metadata for processing
            const contentWithoutTokens = assistantContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");

            // Apply JSON patches to tree as they stream (for live preview)
            const { json } = parseResponse(contentWithoutTokens);
            if (json) {
              setTree((prev) => applyPatches(prev, json));
            }

            // Only show chat portion after "---" separator (don't show raw JSON streaming)
            // Keep message content empty until we have the chat portion
            const parts = contentWithoutTokens.split("---");
            if (parts.length >= 2) {
              // We have the separator, show the chat text
              const chatText = parts.slice(1).join("---").trim();
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: chatText || "..." } : m
                )
              );
            }
            // If no separator yet, message stays empty (loading indicator shows)
          }

          // Extract token metadata if present
          const tokenMatch = assistantContent.match(/\[\[TOKENS:(.*)\]\]$/);
          let tokens: TokenUsage | undefined;
          if (tokenMatch) {
            try {
              tokens = JSON.parse(tokenMatch[1]);
            } catch (e) {
              console.warn("Failed to parse token metadata:", e);
            }
          }

          // Clean content (remove token metadata)
          const cleanContent = assistantContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");

          // Update message with final content and tokens
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: cleanContent, tokens } : m
            )
          );

          // Apply JSON patches when complete
          const { json } = parseResponse(cleanContent);
          if (json) {
            setTree((prev) => applyPatches(prev, json));
          }
        }
      } catch (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Sorry, there was an error processing your request.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, tree, isLoading, generationMode]
  );

  const initRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    if (typeof window === "undefined") return null;

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return null;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setVoiceTranscript(transcript);
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const speakTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      await textToSpeech(text);
    } catch (error) {
      console.error("TTS error:", error);
    }
  }, []);

  const startVoiceCapture = useCallback(() => {
    if (speechState !== "idle" || isVoiceKeyHeldRef.current) return;

    const recognition = initRecognition();
    let fallbackPrompt = "";

    if (!recognition) {
      fallbackPrompt = getNextVoicePrompt();
      setVoiceTranscript(fallbackPrompt);
      setInput(fallbackPrompt);
    } else {
      setVoiceTranscript("");
    }

    isVoiceKeyHeldRef.current = true;
    setSpeechState("recording");

    if (recognition) {
      try {
        recognition.start();
      } catch (error) {
        console.error("Speech recognition start failed:", error);
      }
    }
  }, [getNextVoicePrompt, initRecognition, speechState]);

  const finishVoiceCapture = useCallback(async () => {
    if (speechState !== "recording" || !isVoiceKeyHeldRef.current) return;

    const recognition = recognitionRef.current;
    recognition?.stop();
    isVoiceKeyHeldRef.current = false;
    setSpeechState("processing");

    const transcriptToSend =
      voiceTranscript.trim() || input.trim() || getNextVoicePrompt();

    try {
      await sendMessage(transcriptToSend);
      await speakTranscript(transcriptToSend);
    } finally {
      setSpeechState("idle");
      setVoiceTranscript("");
    }
  }, [
    input,
    sendMessage,
    speechState,
    voiceTranscript,
    getNextVoicePrompt,
    speakTranscript,
  ]);

  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.key === "v" || e.key === "V") && !e.repeat) {
        startVoiceCapture();
      }
    },
    [startVoiceCapture]
  );

  const handleGlobalKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") {
        void finishVoiceCapture();
      }
    },
    [finishVoiceCapture]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("keyup", handleGlobalKeyUp);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("keyup", handleGlobalKeyUp);
    };
  }, [handleGlobalKeyDown, handleGlobalKeyUp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    sendMessage(example);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getAuraStyles = () => {
    switch (speechState) {
      case "recording":
        return "shadow-[0_0_30px_10px_rgba(200,160,100,0.6),0_0_60px_20px_rgba(200,160,100,0.35),0_0_90px_30px_rgba(200,160,100,0.15)]";
      case "processing":
        return "shadow-[0_0_15px_5px_rgba(180,110,110,0.5),0_0_30px_10px_rgba(180,110,110,0.25)]";
      default:
        return "shadow-lg";
    }
  };

  // Build the tree for the Renderer (only when root is set)
  // In ensemble mode, use the selected preview source tree
  const currentTree = generationMode === "ensemble" && ensembleTrees[previewSource].root
    ? ensembleTrees[previewSource]
    : tree;
  const renderTree = currentTree.root
    ? { root: currentTree.root, elements: currentTree.elements }
    : null;

  return (
    <div className="relative h-screen">
      <div className="flex h-full bg-background">
        {/* Left side - Chat interface */}
        <div className="relative flex w-1/2 flex-col border-r border-border/50">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent" />

          {/* Header */}
          <header className="relative z-10 flex items-center justify-between border-b border-border/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary shadow-sm">
                <svg
                  className="size-4 text-primary-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-medium tracking-tight">
                  JSON Render Playground
                </h1>
                <p className="text-xs text-muted-foreground">
                  {isLoading ? "Generating..." : "Describe your UI"}
                </p>
              </div>
            </div>

            {/* Token counter */}
            {totalTokens.total > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
                <svg
                  className="size-3.5 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                </svg>
                <div className="text-xs">
                  <span className="font-medium text-foreground">
                    {totalTokens.total.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground ml-1">tokens</span>
                </div>
              </div>
            )}
          </header>

          {/* Mode toggle - always visible */}
          <div className="relative z-10 border-b border-border/30 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1">
                <button
                  type="button"
                  onClick={() => setGenerationMode("standard")}
                  disabled={isLoading}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50",
                    generationMode === "standard"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => setGenerationMode("ensemble")}
                  disabled={isLoading}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50",
                    generationMode === "ensemble"
                      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ✨ Compare Models
                </button>
              </div>
              {generationMode === "ensemble" && (
                <p className="text-xs text-muted-foreground">
                  3 AI models generate your UI
                </p>
              )}
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="relative z-10 flex-1 overflow-y-auto scroll-smooth px-6 py-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-6">
                {/* Prompt input */}
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={generationMode === "ensemble"
                        ? "Describe the UI you want to create (will generate 3 versions)..."
                        : "Describe the UI you want to create..."}
                      disabled={isLoading}
                      className="min-h-[100px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm focus-visible:ring-0 disabled:opacity-50"
                      rows={4}
                    />
                    <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground/60">
                        Press Enter to generate
                      </p>
                      <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                          input.trim() && !isLoading
                            ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="size-3 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>Generate</>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Example prompts */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Try an example
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_PROMPTS.map((example, index) => (
                      <button
                        key={index}
                        onClick={() => handleExampleClick(example)}
                        disabled={isLoading}
                        className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {(() => {
                  // Find the index of the first assistant message
                  const firstAssistantIndex = messages.findIndex(
                    (m) => m.role === "assistant"
                  );

                  return messages.map((message, index) => {
                    const { chat, json } = parseResponse(message.content);
                    const displayText =
                      message.role === "user" ? message.content : chat || message.content;

                    // Only show JSON for the first assistant message
                    const isFirstAssistant = index === firstAssistantIndex;

                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                          message.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {message.role === "assistant" && (
                          <Avatar className="mt-0.5 size-7 shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-[10px] font-medium">
                              AI
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] space-y-2",
                            message.role === "user" ? "text-right" : "text-left"
                          )}
                        >
                          {/* Chat message */}
                          <div
                            className={cn(
                              "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                              message.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted/60 text-foreground rounded-bl-md"
                            )}
                          >
                            {/* Show loading dots if assistant message is empty during loading */}
                            {message.role === "assistant" && !displayText && isLoading ? (
                              <div className="flex items-center gap-1 py-0.5">
                                <span className="size-1.5 animate-pulse rounded-full bg-foreground/40" />
                                <span
                                  className="size-1.5 animate-pulse rounded-full bg-foreground/40"
                                  style={{ animationDelay: "150ms" }}
                                />
                                <span
                                  className="size-1.5 animate-pulse rounded-full bg-foreground/40"
                                  style={{ animationDelay: "300ms" }}
                                />
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap">{displayText}</p>
                            )}
                          </div>

                          {/* JSON output - only for first assistant message */}
                          {isFirstAssistant && json && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Generated JSON
                              </p>
                              <pre className="overflow-auto rounded-lg bg-muted/50 p-3 text-[10px] text-muted-foreground">
                                {JSON.stringify(tree, null, 2)}
                              </pre>
                            </div>
                          )}

                          {/* Token usage indicator */}
                          {message.role === "assistant" && message.tokens && (
                            <div className="space-y-0.5">
                              {/* Total tokens this turn */}
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
                                <svg
                                  className="size-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={1.5}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                                  />
                                </svg>
                                <span>
                                  {(message.tokens.totalTokens ?? 0).toLocaleString()} tokens
                                </span>
                              </div>
                              {/* Token increase indicator */}
                              <div className="flex items-center gap-0.5 text-xs text-amber-500/70 ml-4">
                                <svg
                                  className="size-3"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
                                  />
                                </svg>
                                <span>
                                  +{(message.tokens.totalTokens ?? 0).toLocaleString()} this turn
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                        {message.role === "user" && (
                          <Avatar className="mt-0.5 size-7 shrink-0">
                            <AvatarFallback className="bg-foreground/5 text-foreground/70 text-[10px] font-medium">
                              You
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    );
                  });
                })()}
                {isLoading && messages[messages.length - 1]?.role === "user" && (
                  <div className="flex gap-3 animate-in fade-in-0 duration-300">
                    <Avatar className="mt-0.5 size-7 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-[10px] font-medium">
                        AI
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3">
                      <span className="size-1.5 animate-pulse rounded-full bg-foreground/40" />
                      <span
                        className="size-1.5 animate-pulse rounded-full bg-foreground/40"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="size-1.5 animate-pulse rounded-full bg-foreground/40"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input area - only show when there are messages (chat mode) */}
          {messages.length > 0 && (
            <div className="relative z-10 border-t border-border/50 p-4">
              <form onSubmit={handleSubmit} className="relative">
                <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe changes or ask a question..."
                    disabled={isLoading}
                    className="min-h-[52px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm focus-visible:ring-0 disabled:opacity-50"
                    rows={1}
                  />
                  <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground/60">
                      Press Enter to send
                    </p>
                    <button
                      type="submit"
                      disabled={isLoading || !input.trim()}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg transition-all duration-200",
                        input.trim() && !isLoading
                          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      <svg
                        className="size-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Right side - Preview */}
        <div className="flex w-1/2 flex-col bg-muted/20">
          <header className="flex flex-col gap-3 border-b border-border/50 px-6 py-4">
            <div className="flex items-center gap-2">
              <svg
                className="size-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <h2 className="text-sm font-medium tracking-tight">Preview</h2>
              {generationMode === "ensemble" && previewSource !== "merged" && ensembleMetadata && (
                <span className="text-xs text-muted-foreground">
                  — {ensembleMetadata.generators[previewSource]?.model || previewSource}
                </span>
              )}
              {isLoading && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  {generationMode === "ensemble" ? "Generating with 3 models..." : "Updating..."}
                </span>
              )}
            </div>
            {/* Preview Source Toggle - only show in ensemble mode after generation */}
            {generationMode === "ensemble" && ensembleTrees.merged.root && (
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {(["merged", "A", "B", "C"] as const).map((source) => {
                    const label = source === "merged"
                      ? "✨ Merged"
                      : ensembleMetadata?.generators[source]?.model?.split("-")[0] || source;
                    const isActive = previewSource === source;
                    const hasContent = ensembleTrees[source].root !== null;

                    return (
                      <button
                        key={source}
                        onClick={() => setPreviewSource(source)}
                        disabled={!hasContent}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                          isActive
                            ? source === "merged"
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
                              : "bg-foreground text-background"
                            : hasContent
                              ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                              : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <Link
                  href="/atoms/ensemble-chat"
                  className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20"
                >
                  <svg
                    className="size-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                    />
                  </svg>
                  Full Dashboard
                </Link>
              </div>
            )}
          </header>

          <ScrollArea className="flex-1 p-6">
            {renderTree ? (
              <DataProvider>
                <VisibilityProvider>
                  <ActionProvider>
                    <div className="space-y-4">
                      <Renderer
                        tree={renderTree as Parameters<typeof Renderer>[0]["tree"]}
                        registry={registry}
                      />
                    </div>
                  </ActionProvider>
                </VisibilityProvider>
              </DataProvider>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-muted/50">
                  <svg
                    className="size-6 text-muted-foreground/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">No preview yet</p>
                <p className="mt-1 max-w-[200px] text-xs text-muted-foreground/60">
                  Describe your UI to generate a wireframe
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      <div
        className={cn(
          "fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border border-border/30 bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm transition-shadow duration-300",
          getAuraStyles()
        )}
      >
        {(["pointer", "ai", "notes", "tools", "files"] as const).map((panel) => (
          <Button
            key={panel}
            className="h-8 w-8 rounded-full"
            onClick={() => setActivePanel(panel)}
            size="icon"
            variant={activePanel === panel ? "default" : "ghost"}
          >
            {panelIconMap[panel]}
          </Button>
        ))}
      </div>
    </div>
  );
}
