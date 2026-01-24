"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Create a welcome card with a greeting and get started button",
  "Build a metrics dashboard with revenue, users, and growth stats",
  "Design a contact form with name, email, and message fields",
  "Create a pricing card with features list and subscribe button",
];

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
  previousTree?: UITree; // Store tree state before this message's changes
};

type UITree = {
  root: string | null;
  elements: Record<string, unknown>;
};

type GenerationMode = "standard" | "ensemble";
type PreviewSource = "merged" | "A" | "B" | "C";

function parseResponse(text: string): { chat: string; json: string; hasSeparator: boolean } {
  if (!text) return { chat: "", json: "", hasSeparator: false };

  const parts = text.split("---");
  if (parts.length >= 2) {
    let jsonSection = parts[0].trim();
    const chatSection = parts.slice(1).join("---").trim();

    const codeBlockMatch = jsonSection.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonSection = codeBlockMatch[1].trim();
    }

    return { chat: chatSection, json: jsonSection, hasSeparator: true };
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return { chat: "", json: trimmed, hasSeparator: false };
  }

  return { chat: trimmed, json: "", hasSeparator: false };
}

// Helper to format streaming output for display in chat
function formatStreamingOutput(
  outputs: Record<string, string>,
  merged: string
): string {
  const lines: string[] = [];

  if (outputs.A) lines.push(`[A] Claude: ${outputs.A.slice(0, 100)}...`);
  if (outputs.B) lines.push(`[B] Gemini: ${outputs.B.slice(0, 100)}...`);
  if (outputs.C) lines.push(`[C] GPT-4o: ${outputs.C.slice(0, 100)}...`);
  if (merged) lines.push(`\n[Merged] ${merged.slice(0, 100)}...`);

  return lines.join("\n");
}

// Compute diff between two JSON trees, returning lines with change markers
function computeTreeDiff(
  oldTree: UITree | null,
  newTree: UITree
): { lines: Array<{ lineNum: number; content: string; type: "added" | "removed" | "unchanged" }>; hasChanges: boolean } {
  const oldJson = oldTree ? JSON.stringify(oldTree, null, 2) : "";
  const newJson = JSON.stringify(newTree, null, 2);

  const oldLines = oldJson ? oldJson.split("\n") : [];
  const newLines = newJson.split("\n");

  // Simple line-by-line diff
  const result: Array<{ lineNum: number; content: string; type: "added" | "removed" | "unchanged" }> = [];
  let hasChanges = false;

  // Use a simple longest common subsequence approach for small diffs
  const maxLen = Math.max(oldLines.length, newLines.length);
  let oldIdx = 0;
  let newIdx = 0;
  let lineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldLine === newLine) {
      result.push({ lineNum: lineNum++, content: newLine, type: "unchanged" });
      oldIdx++;
      newIdx++;
    } else if (oldIdx >= oldLines.length) {
      // Only new lines left
      result.push({ lineNum: lineNum++, content: newLine, type: "added" });
      hasChanges = true;
      newIdx++;
    } else if (newIdx >= newLines.length) {
      // Only old lines left (removed)
      result.push({ lineNum: lineNum++, content: oldLine, type: "removed" });
      hasChanges = true;
      oldIdx++;
    } else {
      // Lines differ - check if old line exists later in new, or new line exists later in old
      const oldInNew = newLines.slice(newIdx).indexOf(oldLine);
      const newInOld = oldLines.slice(oldIdx).indexOf(newLine);

      if (oldInNew === -1 && newInOld === -1) {
        // Neither found - treat as replacement
        result.push({ lineNum: lineNum++, content: oldLine, type: "removed" });
        result.push({ lineNum: lineNum++, content: newLine, type: "added" });
        hasChanges = true;
        oldIdx++;
        newIdx++;
      } else if (oldInNew !== -1 && (newInOld === -1 || oldInNew <= newInOld)) {
        // Old line found later in new - new lines were added
        result.push({ lineNum: lineNum++, content: newLine, type: "added" });
        hasChanges = true;
        newIdx++;
      } else {
        // New line found later in old - old lines were removed
        result.push({ lineNum: lineNum++, content: oldLine, type: "removed" });
        hasChanges = true;
        oldIdx++;
      }
    }
  }

  return { lines: result, hasChanges };
}

function applyPatches(tree: UITree, jsonl: string): UITree {
  if (!jsonl || !jsonl.trim()) return tree;

  const cleaned = jsonl
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

type EnsembleMetadata = {
  evaluatorVariant: string;
  timing: {
    generatorsMs: number;
    evaluatorMs: number;
    totalMs: number;
  };
  generators: {
    A: { model: string; outputLength: number; usage: unknown };
    B: { model: string; outputLength: number; usage: unknown };
    C: { model: string; outputLength: number; usage: unknown };
  };
  evaluator: {
    model: string;
    usage: unknown;
  };
};

interface ChatSidebarProps {
  initialTree?: UITree | null;
  onTreeUpdate?: (tree: UITree | null) => void;
  onEnsembleTreesUpdate?: (trees: {
    merged: UITree;
    A: UITree;
    B: UITree;
    C: UITree;
  }) => void;
  onGenerationModeChange?: (mode: GenerationMode) => void;
  onEnsembleMetadataUpdate?: (metadata: EnsembleMetadata | null) => void;
  onEnsembleGenerationStart?: () => void;
}

export function ChatSidebar({
  initialTree,
  onTreeUpdate,
  onEnsembleTreesUpdate,
  onGenerationModeChange,
  onEnsembleMetadataUpdate,
  onEnsembleGenerationStart,
}: ChatSidebarProps) {
  const [tree, setTree] = useState<UITree>({ root: null, elements: {} });

  // Sync tree state when initialTree prop changes (e.g., when page loads saved tree)
  useEffect(() => {
    if (initialTree && initialTree.root) {
      setTree(initialTree);
    }
  }, [initialTree]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
  const [previewSource, setPreviewSource] = useState<PreviewSource>("merged");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
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

  const currentTree =
    generationMode === "ensemble" && ensembleTrees[previewSource].root
      ? ensembleTrees[previewSource]
      : tree;

  // Notify parent of tree updates
  useEffect(() => {
    onTreeUpdate?.(tree);
  }, [tree, onTreeUpdate]);

  // Notify parent of ensemble trees updates
  useEffect(() => {
    onEnsembleTreesUpdate?.(ensembleTrees);
  }, [ensembleTrees, onEnsembleTreesUpdate]);

  // Notify parent of generation mode changes
  useEffect(() => {
    onGenerationModeChange?.(generationMode);
  }, [generationMode, onGenerationModeChange]);

  // Notify parent of ensemble metadata updates
  useEffect(() => {
    onEnsembleMetadataUpdate?.(ensembleMetadata);
  }, [ensembleMetadata, onEnsembleMetadataUpdate]);

  const toggleMessageExpanded = useCallback((messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      // Capture the current tree state before changes
      const treeBeforeChanges = { ...tree, elements: { ...tree.elements } };

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      if (generationMode === "ensemble") {
        setPreviewSource("merged");
        setEnsembleTrees({
          merged: { root: null, elements: {} },
          A: { root: null, elements: {} },
          B: { root: null, elements: {} },
          C: { root: null, elements: {} },
        });
        setEnsembleMetadata(null);
        // Notify parent to show the ensemble grid
        onEnsembleGenerationStart?.();
      }

      try {
        if (generationMode === "ensemble") {
          const response = await fetch("/api/ensemble-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: text,
              evaluatorVariant: "mergeStructured",
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch response");
          }

          const reader = response.body?.getReader();
          if (!reader) throw new Error("No reader available");

          const decoder = new TextDecoder();
          let buffer = "";
          const assistantId = `assistant-${Date.now()}`;

          // Add streaming placeholder message with previous tree state
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: "", previousTree: treeBeforeChanges },
          ]);

          // Track outputs as they arrive
          const receivedOutputs: Record<string, string> = { A: "", B: "", C: "" };
          let mergedOutput = "";
          let statusMessage = "Starting generation...";
          let metadata: EnsembleMetadata | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process SSE events
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;

                try {
                  const event = JSON.parse(data);

                  if (event.type === "status") {
                    statusMessage = event.message;
                    // Update message to show status
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? { ...m, content: `${statusMessage}\n\n${formatStreamingOutput(receivedOutputs, mergedOutput)}` }
                          : m
                      )
                    );
                  }

                  if (event.type === "generator") {
                    const modelKey = event.model as "A" | "B" | "C";
                    if (event.status === "complete") {
                      receivedOutputs[modelKey] = event.output;

                      // Update the corresponding tree panel immediately
                      const emptyTree: UITree = { root: null, elements: {} };
                      setEnsembleTrees((prev) => ({
                        ...prev,
                        [modelKey]: event.output ? applyPatches(emptyTree, event.output) : emptyTree,
                      }));

                      // Update chat message with progress
                      const completedCount = Object.values(receivedOutputs).filter(Boolean).length;
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === assistantId
                            ? {
                                ...m,
                                content: `Models completed: ${completedCount}/3\n\n${formatStreamingOutput(receivedOutputs, mergedOutput)}`,
                              }
                            : m
                        )
                      );
                    }
                  }

                  if (event.type === "evaluator" && event.status === "streaming") {
                    mergedOutput = event.accumulated || mergedOutput + event.chunk;

                    // Update merged tree as it streams
                    const emptyTree: UITree = { root: null, elements: {} };
                    setEnsembleTrees((prev) => ({
                      ...prev,
                      merged: applyPatches(emptyTree, mergedOutput),
                    }));

                    // Update main tree too
                    setTree(applyPatches(emptyTree, mergedOutput));

                    // Update chat with streaming merged output
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              content: `Merging outputs...\n\n${formatStreamingOutput(receivedOutputs, mergedOutput)}`,
                            }
                          : m
                      )
                    );
                  }

                  if (event.type === "done") {
                    metadata = event.metadata;

                    // Final tree updates
                    const emptyTree: UITree = { root: null, elements: {} };
                    const finalTrees = {
                      merged: event.result ? applyPatches(emptyTree, event.result) : emptyTree,
                      A: receivedOutputs.A ? applyPatches(emptyTree, receivedOutputs.A) : emptyTree,
                      B: receivedOutputs.B ? applyPatches(emptyTree, receivedOutputs.B) : emptyTree,
                      C: receivedOutputs.C ? applyPatches(emptyTree, receivedOutputs.C) : emptyTree,
                    };

                    setEnsembleTrees(finalTrees);
                    setTree(finalTrees.merged);
                    setEnsembleMetadata(metadata);

                    // Calculate total tokens
                    const totalEnsembleTokens =
                      (metadata?.generators?.A?.usage?.totalTokens || 0) +
                      (metadata?.generators?.B?.usage?.totalTokens || 0) +
                      (metadata?.generators?.C?.usage?.totalTokens || 0) +
                      (metadata?.evaluator?.usage?.totalTokens || 0);

                    // Final message
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId
                          ? {
                              ...m,
                              content: `Generated UI from 3 models (${metadata?.timing?.totalMs}ms). Use the preview toggles to compare.`,
                              tokens: {
                                promptTokens: 0,
                                completionTokens: 0,
                                totalTokens: totalEnsembleTokens,
                              },
                            }
                          : m
                      )
                    );
                  }

                  if (event.type === "error") {
                    throw new Error(event.error);
                  }
                } catch (parseError) {
                  console.warn("Failed to parse SSE data:", data, parseError);
                }
              }
            }
          }
        } else {
          const response = await fetch("/api/json-render", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "chat",
              messages: updatedMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
              currentTree,
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

          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: "", previousTree: treeBeforeChanges },
          ]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            assistantContent += chunk;

            const contentWithoutTokens = assistantContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");
            const { json, hasSeparator, chat } = parseResponse(contentWithoutTokens);
            if (json) {
              setTree((prev) => applyPatches(prev, json));
            }

            // Update message content during streaming:
            // - Before separator: show raw JSON so user sees progress
            // - After separator: show the chat text
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: hasSeparator ? (chat || "...") : contentWithoutTokens }
                  : m
              )
            );
          }

          const tokenMatch = assistantContent.match(/\[\[TOKENS:(.*)\]\]$/);
          let tokens: TokenUsage | undefined;
          if (tokenMatch) {
            try {
              tokens = JSON.parse(tokenMatch[1]);
            } catch {
              console.warn("Failed to parse token metadata");
            }
          }

          const cleanContent = assistantContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: cleanContent, tokens } : m
            )
          );

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
    [currentTree, generationMode, messages, isLoading]
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    sendMessage(input);
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
    sendMessage(example);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border/50 bg-background/80 shadow-xl shadow-black/5">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/3 via-transparent to-transparent" />

      <header className="relative z-10 flex items-center justify-between border-b border-border/50 px-6 py-4">
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
                  ? "bg-linear-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Compare 3 Models
            </button>
          </div>
        </div>

        {totalTokens.total > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
            <svg
              className="h-4 w-4 text-muted-foreground"
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

      <div className="relative z-10 flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <div className="space-y-6 px-6 py-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    generationMode === "ensemble"
                      ? "Describe the UI you want to create (will generate 3 versions)..."
                      : "Describe the UI you want to create..."
                  }
                  disabled={isLoading}
                  className="min-h-[100px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm focus-visible:ring-0 disabled:opacity-50"
                  rows={4}
                />
                <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground/60">Press Enter to generate</p>
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
                        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <ScrollArea className="flex h-full flex-col overflow-y-auto px-6 py-4">
            <div ref={scrollRef} className="flex flex-col space-y-6">
              {(() => {
                const firstAssistantIndex = messages.findIndex((m) => m.role === "assistant");
                return messages.map((message, index) => {
                  const { chat, json, hasSeparator } = parseResponse(message.content);
                  const isFirstAssistant = index === firstAssistantIndex;
                  const isCurrentlyStreaming = isLoading && index === messages.length - 1 && message.role === "assistant";

                  // Determine what to display:
                  // - User messages: show content as-is
                  // - Assistant streaming without separator: show JSON being generated
                  // - Assistant with separator or done: show chat text
                  let displayText = message.content;
                  let showStreamingJson = false;

                  // Check if this is an ensemble streaming message
                  const isEnsembleStreaming =
                    isCurrentlyStreaming &&
                    generationMode === "ensemble" &&
                    (message.content.includes("Models completed:") ||
                      message.content.includes("Merging") ||
                      message.content.includes("Starting generation"));

                  if (message.role === "assistant") {
                    if (isCurrentlyStreaming && !hasSeparator && json && !isEnsembleStreaming) {
                      // Streaming JSON - show it in a code-like format
                      showStreamingJson = true;
                      displayText = json;
                    } else if (hasSeparator) {
                      // Has separator - show chat text
                      displayText = chat || "...";
                    } else if (chat) {
                      displayText = chat;
                    }
                  }

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] space-y-2",
                          message.role === "user" ? "text-right" : "text-left"
                        )}
                      >
                        <div
                          className={cn(
                            "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted/60 text-foreground rounded-bl-md"
                          )}
                        >
                          {message.role === "assistant" && !displayText && isLoading ? (
                            <div className="flex items-center gap-1 py-0.5">
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/40" />
                              <span
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/40"
                                style={{ animationDelay: "150ms" }}
                              />
                              <span
                                className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/40"
                                style={{ animationDelay: "300ms" }}
                              />
                            </div>
                          ) : showStreamingJson ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-medium">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                                Generating UI...
                              </div>
                              <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                                {displayText}
                              </pre>
                            </div>
                          ) : isEnsembleStreaming ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-[10px] text-purple-600 font-medium">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
                                Comparing 3 Models...
                              </div>
                              <pre className="font-mono text-[10px] text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                                {message.content}
                              </pre>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{displayText}</p>
                          )}
                        </div>
                        {message.role === "assistant" && message.tokens && (
                          <div className="space-y-2">
                            {/* Clickable token count to expand/collapse JSON view */}
                            <button
                              type="button"
                              onClick={() => toggleMessageExpanded(message.id)}
                              className="group flex items-center gap-2 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5">
                                <svg
                                  className="h-3 w-3"
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
                                <span>{(message.tokens.totalTokens ?? 0).toLocaleString()} tokens</span>
                              </div>
                              <div className="flex items-center gap-0.5 text-amber-500/70">
                                <svg
                                  className="h-3 w-3"
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
                                <span>+{(message.tokens.totalTokens ?? 0).toLocaleString()} this turn</span>
                              </div>
                              <svg
                                className={cn(
                                  "h-3 w-3 transition-transform duration-200",
                                  expandedMessages.has(message.id) ? "rotate-180" : ""
                                )}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                                />
                              </svg>
                              <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                {expandedMessages.has(message.id) ? "hide" : "show"} json
                              </span>
                            </button>

                            {/* Expandable JSON/Diff view */}
                            {expandedMessages.has(message.id) && !isCurrentlyStreaming && (
                              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                                {(() => {
                                  const hasPreviousTree = message.previousTree && message.previousTree.root;

                                  if (!hasPreviousTree && isFirstAssistant) {
                                    // First generation - show full JSON tree
                                    return (
                                      <>
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                          Generated JSON Tree
                                        </p>
                                        <pre className="overflow-auto rounded-lg bg-muted/50 p-3 text-[10px] text-muted-foreground max-h-[250px] font-mono">
                                          {JSON.stringify(tree, null, 2)}
                                        </pre>
                                      </>
                                    );
                                  } else if (hasPreviousTree) {
                                    // Subsequent modification - show diff
                                    const { lines, hasChanges } = computeTreeDiff(message.previousTree!, tree);

                                    if (!hasChanges) {
                                      return (
                                        <p className="text-[10px] text-muted-foreground italic">
                                          No structural changes detected
                                        </p>
                                      );
                                    }

                                    return (
                                      <>
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                          JSON Diff
                                        </p>
                                        <div className="overflow-auto rounded-lg bg-muted/50 max-h-[250px] font-mono text-[10px]">
                                          {lines.map((line, idx) => (
                                            <div
                                              key={idx}
                                              className={cn(
                                                "flex",
                                                line.type === "added" && "bg-emerald-500/10",
                                                line.type === "removed" && "bg-red-500/10"
                                              )}
                                            >
                                              <span className="w-8 shrink-0 text-right pr-2 text-muted-foreground/40 select-none border-r border-border/30">
                                                {line.lineNum}
                                              </span>
                                              <span className={cn(
                                                "w-4 shrink-0 text-center select-none",
                                                line.type === "added" && "text-emerald-500",
                                                line.type === "removed" && "text-red-500"
                                              )}>
                                                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                                              </span>
                                              <span className={cn(
                                                "flex-1 px-2 whitespace-pre",
                                                line.type === "added" && "text-emerald-600",
                                                line.type === "removed" && "text-red-600 line-through opacity-70",
                                                line.type === "unchanged" && "text-muted-foreground"
                                              )}>
                                                {line.content}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </>
                                    );
                                  } else {
                                    // Fallback - show current tree
                                    return (
                                      <>
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                          Current JSON Tree
                                        </p>
                                        <pre className="overflow-auto rounded-lg bg-muted/50 p-3 text-[10px] text-muted-foreground max-h-[250px] font-mono">
                                          {JSON.stringify(tree, null, 2)}
                                        </pre>
                                      </>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 animate-in fade-in-0 duration-300">
                  <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-linear-to-br from-primary/20 to-primary/10 text-primary text-[10px] font-medium">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted/60 px-4 py-3">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/40" />
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/40"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground/40"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

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
                <p className="text-[10px] text-muted-foreground/60">Press Enter to send</p>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
