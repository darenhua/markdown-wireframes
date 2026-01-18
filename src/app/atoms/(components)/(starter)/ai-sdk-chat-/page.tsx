"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { readContext } from "./actions";

export default function RachelV1Page() {
  const [input, setInput] = useState("");
  const [contextContent, setContextContent] = useState("");
  const { messages, sendMessage, status } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = status === "streaming" || status === "submitted";

  const fetchContext = useCallback(async () => {
    const content = await readContext();
    setContextContent(content);
  }, []);

  // Fetch context on mount and when messages change
  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  // Poll for context updates while streaming (tool may have written to file)
  useEffect(() => {
    if (status === "streaming") {
      const interval = setInterval(fetchContext, 1000);
      return () => clearInterval(interval);
    }
    // Fetch once more after streaming ends
    if (status === "ready") {
      fetchContext();
    }
  }, [status, fetchContext]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-screen bg-background">
      {/* Left side - Chat interface */}
      <div className="relative flex w-1/2 flex-col border-r border-border/50">
        {/* Subtle gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent" />

        {/* Header */}
        <header className="relative z-10 flex items-center gap-3 px-6 py-4">
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-medium tracking-tight">Assistant</h1>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Thinking..." : "Ready to help"}
            </p>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="relative z-10 flex-1 overflow-y-auto scroll-smooth px-6 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
                <svg
                  className="size-8 text-primary/60"
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
                Ask me anything. I'll extract and track your requirements as we
                chat.
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
                    <Avatar size="sm" className="mt-0.5 shrink-0">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary text-[10px] font-medium">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] space-y-1",
                      message.role === "user" ? "text-right" : "text-left"
                    )}
                  >
                    {message.parts.map((part, partIndex) =>
                      part.type === "text" ? (
                        <div
                          key={partIndex}
                          className={cn(
                            "inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted/60 text-foreground rounded-bl-md"
                          )}
                        >
                          <p className="whitespace-pre-wrap">{part.text}</p>
                        </div>
                      ) : part.type === "tool-invocation" ? (
                        <div
                          key={partIndex}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground"
                        >
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
                          Updating context...
                        </div>
                      ) : null
                    )}
                  </div>
                  {message.role === "user" && (
                    <Avatar size="sm" className="mt-0.5 shrink-0">
                      <AvatarFallback className="bg-foreground/5 text-foreground/70 text-[10px] font-medium">
                        You
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 animate-in fade-in-0 duration-300">
                  <Avatar size="sm" className="mt-0.5 shrink-0">
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

        {/* Input area */}
        <div className="relative z-10 p-4">
          <form onSubmit={handleSubmit} className="relative">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5">
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
                  Press Enter to send, Shift + Enter for new line
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
      </div>

      {/* Right side - Context panel */}
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 className="text-sm font-medium tracking-tight">context.md</h2>
          {contextContent && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              Auto-updated
            </span>
          )}
        </header>

        <ScrollArea className="flex-1 p-6">
          {contextContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <MarkdownRenderer content={contextContent} />
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
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No context yet</p>
              <p className="mt-1 max-w-[200px] text-xs text-muted-foreground/60">
                Start chatting and I'll extract your requirements here
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// Simple markdown renderer
function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        // Headers
        if (line.startsWith("# ")) {
          return (
            <h1
              key={index}
              className="text-xl font-semibold tracking-tight mt-4 first:mt-0"
            >
              {line.slice(2)}
            </h1>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2
              key={index}
              className="text-lg font-medium tracking-tight mt-4 first:mt-0"
            >
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={index} className="text-base font-medium mt-3 first:mt-0">
              {line.slice(4)}
            </h3>
          );
        }
        // List items
        if (line.startsWith("- ")) {
          return (
            <div key={index} className="flex gap-2 text-sm">
              <span className="text-primary">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        // Empty lines
        if (line.trim() === "") {
          return <div key={index} className="h-2" />;
        }
        // Regular paragraphs
        return (
          <p key={index} className="text-sm leading-relaxed">
            {line}
          </p>
        );
      })}
    </div>
  );
}
