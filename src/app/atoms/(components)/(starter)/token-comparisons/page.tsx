"use client";

import { useState, useRef, useCallback } from "react";
import {
  Renderer,
  DataProvider,
  VisibilityProvider,
  ActionProvider,
} from "@json-render/react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { registry } from "../try-jsonrender/registry";

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type UITree = {
  root: string | null;
  elements: Record<string, unknown>;
};

type StreamState = {
  content: string;
  tokens: TokenUsage | null;
  isStreaming: boolean;
  error: string | null;
};

function parseWireframeResponse(text: string): { chat: string; json: string } {
  if (!text) return { chat: "", json: "" };
  const parts = text.split("---");
  if (parts.length >= 2) {
    let jsonSection = parts[0].trim();
    const chatSection = parts.slice(1).join("---").trim();
    const codeBlockMatch = jsonSection.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonSection = codeBlockMatch[1].trim();
    return { chat: chatSection, json: jsonSection };
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return { chat: "", json: trimmed };
  return { chat: trimmed, json: "" };
}

function applyPatches(tree: UITree, jsonl: string): UITree {
  if (!jsonl?.trim()) return tree;
  const newTree = { ...tree, elements: { ...tree.elements } };
  const lines = jsonl.split("\n").filter((line) => line.trim());
  for (const line of lines) {
    try {
      const patch = JSON.parse(line);
      if (patch.op === "set") {
        if (patch.path === "/root") newTree.root = patch.value;
        else if (patch.path.startsWith("/elements/")) {
          newTree.elements[patch.path.replace("/elements/", "")] = patch.value;
        }
      }
    } catch { /* skip */ }
  }
  return newTree;
}

export default function TokenComparisonsPage() {
  const [tree, setTree] = useState<UITree>({ root: null, elements: {} });
  const [input, setInput] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [wireframeState, setWireframeState] = useState<StreamState>({
    content: "", tokens: null, isStreaming: false, error: null,
  });
  const [pureState, setPureState] = useState<StreamState>({
    content: "", tokens: null, isStreaming: false, error: null,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const streamWireframe = useCallback(async (prompt: string) => {
    setWireframeState({ content: "", tokens: null, isStreaming: true, error: null });
    try {
      const response = await fetch("/api/json-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          messages: [{ role: "user", content: prompt }],
          currentTree: { root: null, elements: {} },
        }),
      });
      if (!response.ok) throw new Error("Failed to fetch wireframe response");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      const decoder = new TextDecoder();
      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
        const contentWithoutTokens = fullContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");
        const { json } = parseWireframeResponse(contentWithoutTokens);
        if (json) setTree((prev) => applyPatches(prev, json));
        setWireframeState((prev) => ({ ...prev, content: contentWithoutTokens }));
      }
      const tokenMatch = fullContent.match(/\[\[TOKENS:(.*)\]\]$/);
      let tokens: TokenUsage | null = null;
      if (tokenMatch) try { tokens = JSON.parse(tokenMatch[1]); } catch { /* skip */ }
      const cleanContent = fullContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");
      const { json } = parseWireframeResponse(cleanContent);
      if (json) setTree((prev) => applyPatches(prev, json));
      setWireframeState({ content: cleanContent, tokens, isStreaming: false, error: null });
    } catch (error) {
      setWireframeState((prev) => ({
        ...prev, isStreaming: false, error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  const streamPure = useCallback(async (prompt: string) => {
    setPureState({ content: "", tokens: null, isStreaming: true, error: null });
    try {
      const response = await fetch("/api/pure-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!response.ok) throw new Error("Failed to fetch pure response");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");
      const decoder = new TextDecoder();
      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
        const contentWithoutTokens = fullContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");
        setPureState((prev) => ({ ...prev, content: contentWithoutTokens }));
      }
      const tokenMatch = fullContent.match(/\[\[TOKENS:(.*)\]\]$/);
      let tokens: TokenUsage | null = null;
      if (tokenMatch) try { tokens = JSON.parse(tokenMatch[1]); } catch { /* skip */ }
      const cleanContent = fullContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");
      setPureState({ content: cleanContent, tokens, isStreaming: false, error: null });
    } catch (error) {
      setPureState((prev) => ({
        ...prev, isStreaming: false, error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  const sendPrompt = useCallback((text: string) => {
    if (!text.trim()) return;
    setHasStarted(true);
    setTree({ root: null, elements: {} });
    streamWireframe(text);
    streamPure(text);
  }, [streamWireframe, streamPure]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendPrompt(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(input);
    }
  };

  const isLoading = wireframeState.isStreaming || pureState.isStreaming;
  const renderTree = tree.root ? { root: tree.root, elements: tree.elements } : null;
  const { chat: wireframeChat } = parseWireframeResponse(wireframeState.content);

  return (
    <div className="flex h-screen bg-background">
      {/* Left side - Wireframe Render Output */}
      <div className="relative flex w-[65%] flex-col border-r border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent" />

        <header className="relative z-10 flex items-center gap-2 border-b border-border/50 px-6 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary shadow-sm">
            <svg className="size-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-medium tracking-tight">Wireframe Output</h1>
            <p className="text-xs text-muted-foreground">
              {wireframeState.isStreaming ? "Rendering..." : "Live preview"}
            </p>
          </div>
        </header>

        <ScrollArea className="relative z-10 flex-1 p-6">
          {renderTree ? (
            <DataProvider>
              <VisibilityProvider>
                <ActionProvider>
                  <Renderer tree={renderTree as Parameters<typeof Renderer>[0]["tree"]} registry={registry} />
                </ActionProvider>
              </VisibilityProvider>
            </DataProvider>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10">
                <svg className="size-8 text-primary/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-medium tracking-tight text-foreground/90">No preview yet</h2>
              <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground">
                Enter a prompt to compare token usage between methods
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right side - Token Comparison Panel */}
      <div className="flex w-[35%] flex-col h-screen">
        {/* Prompt Input */}
        <div className="shrink-0 border-b border-border/50 p-4">
          <form onSubmit={handleSubmit}>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter prompt to compare both methods..."
                disabled={isLoading}
                className="min-h-[80px] resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 disabled:opacity-50"
                rows={3}
              />
              <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2">
                <p className="text-[10px] text-muted-foreground/60">Press Enter to compare</p>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    input.trim() && !isLoading
                      ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <>
                      <svg className="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Streaming...
                    </>
                  ) : "Compare"}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Split panels container - takes remaining height */}
        <div className="flex flex-1 flex-col min-h-0">
          {/* Wireframe Chat Section - Fixed 50% */}
          <div className="relative flex h-1/2 flex-col border-b border-border/50 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-blue-500/[0.02] via-transparent to-transparent" />

            <header className="relative z-10 shrink-0 flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xs font-medium tracking-tight">Vercel AI SDK</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {wireframeState.isStreaming ? "Streaming..." : "json-render"}
                  </p>
                </div>
              </div>
              {wireframeState.tokens && (
                <div className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1">
                  <svg className="size-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <span className="text-xs font-semibold text-blue-600">
                    {(wireframeState.tokens.totalTokens ?? 0).toLocaleString()}
                  </span>
                </div>
              )}
            </header>

            <ScrollArea className="relative z-10 flex-1 min-h-0">
              <div className="p-4">
                {hasStarted ? (
                  <div className="space-y-3">
                    {wireframeState.error ? (
                      <p className="text-xs text-destructive">{wireframeState.error}</p>
                    ) : (
                      <>
                        <div className={cn(
                          "rounded-2xl rounded-bl-md bg-blue-500/5 px-4 py-2.5 text-sm leading-relaxed",
                          !wireframeChat && wireframeState.isStreaming && "py-3"
                        )}>
                          {wireframeChat || (wireframeState.isStreaming ? (
                            <span className="flex items-center gap-1">
                              <span className="size-1.5 animate-pulse rounded-full bg-blue-500/40" />
                              <span className="size-1.5 animate-pulse rounded-full bg-blue-500/40" style={{ animationDelay: "150ms" }} />
                              <span className="size-1.5 animate-pulse rounded-full bg-blue-500/40" style={{ animationDelay: "300ms" }} />
                            </span>
                          ) : <span className="text-muted-foreground text-xs">Waiting...</span>)}
                        </div>
                        {wireframeState.tokens && (
                          <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-[10px]">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Input</span>
                              <span className="font-medium text-foreground">{(wireframeState.tokens.promptTokens ?? 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Output</span>
                              <span className="font-medium text-foreground">{(wireframeState.tokens.completionTokens ?? 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t border-border/50 pt-1.5 font-medium">
                              <span>Total</span>
                              <span className="text-blue-600">{(wireframeState.tokens.totalTokens ?? 0).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-xs text-muted-foreground/60">Structured JSON output with UI rendering</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Pure Chat Section - Fixed 50% */}
          <div className="relative flex h-1/2 flex-col overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/[0.02] via-transparent to-transparent" />

            <header className="relative z-10 shrink-0 flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
                  <svg className="size-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xs font-medium tracking-tight">Pure Chat</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {pureState.isStreaming ? "Streaming..." : "streamText"}
                  </p>
                </div>
              </div>
              {pureState.tokens && (
                <div className="flex items-center gap-1.5 rounded-lg bg-violet-500/10 px-2.5 py-1">
                  <svg className="size-3 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <span className="text-xs font-semibold text-violet-600">
                    {(pureState.tokens.totalTokens ?? 0).toLocaleString()}
                  </span>
                </div>
              )}
            </header>

            <ScrollArea className="relative z-10 flex-1 min-h-0">
              <div className="p-4">
                {hasStarted ? (
                  <div className="space-y-3">
                    {pureState.error ? (
                      <p className="text-xs text-destructive">{pureState.error}</p>
                    ) : (
                      <>
                        <div className={cn(
                          "rounded-2xl rounded-bl-md bg-violet-500/5 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                          !pureState.content && pureState.isStreaming && "py-3"
                        )}>
                          {pureState.content || (pureState.isStreaming ? (
                            <span className="flex items-center gap-1">
                              <span className="size-1.5 animate-pulse rounded-full bg-violet-500/40" />
                              <span className="size-1.5 animate-pulse rounded-full bg-violet-500/40" style={{ animationDelay: "150ms" }} />
                              <span className="size-1.5 animate-pulse rounded-full bg-violet-500/40" style={{ animationDelay: "300ms" }} />
                            </span>
                          ) : <span className="text-muted-foreground text-xs">Waiting...</span>)}
                        </div>
                        {pureState.tokens && (
                          <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-[10px]">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Input</span>
                              <span className="font-medium text-foreground">{(pureState.tokens.promptTokens ?? 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground">
                              <span>Output</span>
                              <span className="font-medium text-foreground">{(pureState.tokens.completionTokens ?? 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between border-t border-border/50 pt-1.5 font-medium">
                              <span>Total</span>
                              <span className="text-violet-600">{(pureState.tokens.totalTokens ?? 0).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-xs text-muted-foreground/60">Plain text streaming response</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Token Comparison Summary */}
        {wireframeState.tokens && pureState.tokens && (
          <div className="shrink-0 border-t border-border/50 bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Difference</span>
              <span className={cn(
                "text-xs font-semibold",
                (wireframeState.tokens.totalTokens ?? 0) > (pureState.tokens.totalTokens ?? 0)
                  ? "text-amber-600"
                  : (wireframeState.tokens.totalTokens ?? 0) < (pureState.tokens.totalTokens ?? 0)
                  ? "text-green-600"
                  : "text-muted-foreground"
              )}>
                {(wireframeState.tokens.totalTokens ?? 0) > (pureState.tokens.totalTokens ?? 0)
                  ? `Wireframe +${((wireframeState.tokens.totalTokens ?? 0) - (pureState.tokens.totalTokens ?? 0)).toLocaleString()}`
                  : (wireframeState.tokens.totalTokens ?? 0) < (pureState.tokens.totalTokens ?? 0)
                  ? `Pure +${((pureState.tokens.totalTokens ?? 0) - (wireframeState.tokens.totalTokens ?? 0)).toLocaleString()}`
                  : "Equal"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
