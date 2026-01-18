"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LiveProvider, LivePreview, LiveError } from "react-live";

// Components available for JSX rendering
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

// Scope for react-live - components available in JSX
const liveScope = {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Badge,
  Alert,
  AlertTitle,
  AlertDescription,
  Checkbox,
  Separator,
  cn,
};

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

// Extract code blocks from markdown content
function extractCodeBlocks(
  content: string
): Array<{ language: string; code: string }> {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string }> = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
    });
  }

  return blocks;
}


export default function PureChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Get the latest assistant message for preview
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && messages[i].content) {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  // Extract code blocks from the latest message
  const codeBlocks = useMemo(() => {
    if (!latestAssistantMessage) return [];
    return extractCodeBlocks(latestAssistantMessage.content);
  }, [latestAssistantMessage]);

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

      try {
        const response = await fetch("/api/pure-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.details || "Failed to fetch response");
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

          // Update the assistant message with accumulated content (strip token metadata for display)
          const displayContent = assistantContent.replace(
            /\n\[\[TOKENS:.*\]\]$/,
            ""
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: displayContent } : m
            )
          );
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
        const cleanContent = assistantContent.replace(
          /\n\[\[TOKENS:.*\]\]$/,
          ""
        );

        // Update message with final content and tokens
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: cleanContent, tokens } : m
          )
        );
      } catch (error) {
        console.error("Error sending message:", error);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Sorry, there was an error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
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

  return (
    <div className="flex h-screen bg-background">
      {/* Left side - Chat */}
      <div className="relative flex w-1/2 flex-col border-r border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/[0.02] via-transparent to-transparent" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <svg
                className="size-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-medium tracking-tight">
                Claude Haiku 4.5
              </h1>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Thinking..." : "Ready to chat"}
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

        {/* Messages */}
        <div
          ref={scrollRef}
          className="relative z-10 flex-1 overflow-y-auto scroll-smooth px-6 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/10">
                <svg
                  className="size-8 text-violet-500/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-lg font-medium tracking-tight text-foreground/90">
                Start a conversation
              </h2>
              <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground">
                Chat with Claude Sonnet 4.5. Code and markdown will appear in
                the preview panel.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
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
                      <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-purple-600/10 text-violet-600 text-[10px] font-medium">
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
                    {/* Chat message - strip code blocks for assistant messages */}
                    <div
                      className={cn(
                        "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        message.role === "user"
                          ? "bg-violet-600 text-white rounded-br-md"
                          : "bg-muted/60 text-foreground rounded-bl-md"
                      )}
                    >
                      <p className="whitespace-pre-wrap">
                        {message.role === "assistant"
                          ? message.content.replace(/```[\s\S]*?```/g, "").trim()
                          : message.content}
                      </p>
                    </div>

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
                            <span className="text-muted-foreground/40 ml-1">
                              (in:{" "}
                              {(message.tokens.promptTokens ?? 0).toLocaleString()} +
                              out:{" "}
                              {(message.tokens.completionTokens ?? 0).toLocaleString()})
                            </span>
                          </span>
                        </div>
                        {/* Token increase indicator */}
                        <div className="flex items-center gap-0.5 text-xs text-violet-500/70 ml-4">
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
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 animate-in fade-in-0 duration-300">
                  <Avatar className="mt-0.5 size-7 shrink-0">
                    <AvatarFallback className="bg-gradient-to-br from-violet-500/20 to-purple-600/10 text-violet-600 text-[10px] font-medium">
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

        {/* Input area */}
        <div className="relative z-10 border-t border-border/50 p-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-violet-500/30 focus-within:shadow-md focus-within:shadow-violet-500/5">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
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
                      ? "bg-violet-600 text-white shadow-sm hover:bg-violet-700 hover:shadow"
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
      </div>

      {/* Right side - Preview Panel */}
      <div className="flex w-1/2 flex-col bg-muted/20">
        <header className="flex items-center gap-2 border-b border-border/50 px-6 py-4">
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
              d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
            />
          </svg>
          <h2 className="text-sm font-medium tracking-tight">Preview</h2>
          {isLoading && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-violet-500" />
              Streaming...
            </span>
          )}
        </header>

        <ScrollArea className="flex-1 p-6">
          {latestAssistantMessage ? (
            <div className="space-y-6">
              {/* Render JSX code blocks as live UI */}
              {codeBlocks.length > 0 && (
                <div className="space-y-4">
                  {codeBlocks.map((block, index) => {
                    // Check if it's JSX/TSX that we can render
                    const isJsx = ["jsx", "tsx", "javascript", "js"].includes(
                      block.language.toLowerCase()
                    );

                    if (isJsx) {
                      // Clean up the code for react-live
                      let cleanCode = block.code.trim();

                      // Remove import statements
                      cleanCode = cleanCode.replace(/^import\s+.*?;?\s*$/gm, "").trim();

                      // Remove export statements
                      cleanCode = cleanCode
                        .replace(/^export\s+default\s+/gm, "")
                        .replace(/^export\s+/gm, "")
                        .trim();

                      // Check if code already starts with JSX
                      const startsWithJsx = /^<[A-Z]/.test(cleanCode);

                      if (!startsWithJsx) {
                        // Try to extract JSX from return statement
                        // Handle: return (<JSX>)  or  return <JSX>
                        const returnMatch = cleanCode.match(
                          /return\s*\(?\s*(<[\s\S]*>)\s*\)?;?\s*\}?\s*;?\s*$/
                        );
                        if (returnMatch) {
                          cleanCode = returnMatch[1].trim();
                        } else {
                          // If we can't extract JSX, show as code instead
                          return (
                            <div
                              key={index}
                              className="rounded-lg border border-border/60 overflow-hidden"
                            >
                              <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border/40">
                                <span className="text-xs font-medium text-muted-foreground uppercase">
                                  {block.language}
                                </span>
                                <button
                                  onClick={() =>
                                    navigator.clipboard.writeText(block.code)
                                  }
                                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Copy
                                </button>
                              </div>
                              <pre className="p-4 overflow-x-auto bg-background">
                                <code className="text-xs text-foreground/90 font-mono">
                                  {block.code}
                                </code>
                              </pre>
                            </div>
                          );
                        }
                      }

                      // Remove trailing semicolons and closing braces that might be left over
                      cleanCode = cleanCode.replace(/\s*;?\s*\}?\s*;?\s*$/, "").trim();

                      // Don't wrap in fragment - react-live handles single root elements fine
                      const liveCode = cleanCode;

                      return (
                        <div
                          key={index}
                          className="rounded-lg border border-border/60 overflow-hidden"
                        >
                          <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border/40">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              Live Preview
                            </span>
                            <button
                              onClick={() =>
                                navigator.clipboard.writeText(block.code)
                              }
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Copy Code
                            </button>
                          </div>
                          <div className="p-4 bg-background">
                            <LiveProvider code={liveCode} scope={liveScope} noInline={false}>
                              <LiveError className="text-xs text-red-500 mb-2 p-2 bg-red-50 dark:bg-red-950/20 rounded" />
                              <LivePreview />
                            </LiveProvider>
                          </div>
                        </div>
                      );
                    }

                    // Non-JSX code blocks - show as code
                    return (
                      <div
                        key={index}
                        className="rounded-lg border border-border/60 overflow-hidden"
                      >
                        <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border/40">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {block.language}
                          </span>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(block.code)
                            }
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="p-4 overflow-x-auto bg-background">
                          <code className="text-xs text-foreground/90 font-mono">
                            {block.code}
                          </code>
                        </pre>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                    d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No preview yet</p>
              <p className="mt-1 max-w-[200px] text-xs text-muted-foreground/60">
                Code and formatted content will appear here
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
