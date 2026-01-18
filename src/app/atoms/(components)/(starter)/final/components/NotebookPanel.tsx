"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Send, FileText, RefreshCw, ChevronLeft } from "lucide-react";
import { readElementContext, type SelectorInfo } from "../spec-actions";

interface UITree {
  root: string;
  elements: Record<
    string,
    {
      key: string;
      type: string;
      props: Record<string, unknown>;
      children?: string[];
    }
  >;
}

interface NotebookPanelProps {
  pageName: string;
  elementKey: string | null;
  tree: UITree | null;
  onContextUpdate: (content: string) => void;
  initialContext?: string;
  onElementKeyChange?: (key: string) => void;
}

export function NotebookPanel({
  pageName,
  elementKey: externalElementKey,
  tree,
  onContextUpdate,
  initialContext = "",
  onElementKeyChange,
}: NotebookPanelProps) {
  const [contextContent, setContextContent] = useState(initialContext);
  const [input, setInput] = useState("");
  const [selectedInternalKey, setSelectedInternalKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);
  const prevElementKey = useRef<string | null>(null);

  // Use external elementKey if provided, otherwise use internal selection
  const elementKey = externalElementKey || selectedInternalKey;

  // Get element info for context
  const element = elementKey && tree ? tree.elements[elementKey] : null;

  // Get list of elements for manual selection
  const elementOptions = tree
    ? Object.entries(tree.elements).map(([key, el]) => ({
      key,
      type: el.type,
      label: (el.props?.label || el.props?.text || el.props?.title || key) as string,
    }))
    : [];

  // Handle manual element selection
  const handleElementSelect = (key: string) => {
    setSelectedInternalKey(key);
    onElementKeyChange?.(key);
  };

  // Go back to selector
  const handleBack = () => {
    setSelectedInternalKey(null);
    onElementKeyChange?.("");
  };

  // Build selector info from element
  const selectors: SelectorInfo | undefined = element
    ? {
        elementKey: elementKey || undefined,
        textContent: (element.props?.label || element.props?.text || element.props?.title) as string | undefined,
      }
    : undefined;

  // useChat hook with spec-chat API
  const { messages, sendMessage, status, setMessages } = useChat({
    api: "/api/spec-chat",
    body: {
      pageName,
      elementKey,
      treeContext: tree ? JSON.stringify(tree, null, 2) : null,
      elementContext: element ? JSON.stringify(element, null, 2) : null,
      selectors,
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Fetch context from server
  const fetchContext = useCallback(async () => {
    if (!elementKey) return;
    const content = await readElementContext(pageName, elementKey);
    setContextContent(content);
    onContextUpdate(content);
  }, [pageName, elementKey, onContextUpdate]);

  // Reset when element changes
  useEffect(() => {
    if (elementKey !== prevElementKey.current) {
      prevElementKey.current = elementKey;
      setMessages([]);
      hasAutoStarted.current = false;
      fetchContext();
    }
  }, [elementKey, setMessages, fetchContext]);

  // Poll for context updates during streaming
  useEffect(() => {
    if (status === "streaming") {
      const interval = setInterval(fetchContext, 1000);
      return () => clearInterval(interval);
    }
    if (status === "ready" && messages.length > 0) {
      fetchContext();
    }
  }, [status, fetchContext, messages.length]);

  // AUTO-START: Send initial greeting when element is selected and no messages
  useEffect(() => {
    if (
      elementKey &&
      element &&
      messages.length === 0 &&
      !hasAutoStarted.current &&
      !isLoading
    ) {
      hasAutoStarted.current = true;
      // Debug: log what's being sent
      console.log("[NotebookPanel] Auto-start with:", {
        pageName,
        elementKey,
        hasTree: !!tree,
        treeElements: tree ? Object.keys(tree.elements) : [],
        element,
      });
      sendMessage({
        text: `[SYSTEM: User has selected element "${elementKey}" of type "${element.type}". Start the spec conversation by asking about the first missing field in the context file.]`,
      });
    }
  }, [elementKey, element, messages.length, isLoading, sendMessage, pageName, tree]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  // No tree loaded
  if (!elementKey && !tree) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <FileText className="h-6 w-6 text-muted-foreground/50 mb-2" />
        <p className="text-xs font-medium">No tree loaded</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Switch to Tools panel first
        </p>
      </div>
    );
  }

  // Show element selector (max 3 items)
  if (!elementKey && tree && elementOptions.length > 0) {
    return (
      <div className="flex flex-col h-full p-2">
        <p className="text-[10px] text-muted-foreground mb-2">Select component:</p>
        <div className="space-y-1">
          {elementOptions.slice(0, 3).map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleElementSelect(opt.key)}
              className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[8px] px-1 py-0">
                  {opt.type}
                </Badge>
                <span className="font-mono text-muted-foreground truncate text-[10px]">
                  {opt.key}
                </span>
              </div>
            </button>
          ))}
          {elementOptions.length > 3 && (
            <p className="text-[9px] text-muted-foreground/60 px-2">
              +{elementOptions.length - 3} more
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main chat view - horizontal split (spec on top, chat on bottom)
  // Using fixed heights with overflow-auto instead of ScrollArea for reliable scrolling
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Spec Preview (top) - fixed height */}
      <div className="shrink-0 border-b">
        <div className="px-2 py-1 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleBack}
              className="p-0.5 hover:bg-muted rounded"
            >
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            </button>
            <Badge variant="outline" className="text-[8px] px-1 py-0">
              {element?.type}
            </Badge>
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {elementKey}
            </span>
          </div>
          <button
            onClick={fetchContext}
            className="p-0.5 hover:bg-muted rounded"
          >
            <RefreshCw className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        </div>
        <div className="h-[80px] overflow-y-auto">
          <div className="p-2">
            {contextContent ? (
              <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap font-mono leading-tight">
                {contextContent}
              </pre>
            ) : (
              <p className="text-[9px] text-muted-foreground/60 italic">
                No spec yet - answer questions below to build it
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chat (bottom) - flex to fill remaining space */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Messages area - scrollable */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 space-y-2"
        >
          {messages.length === 0 && !isLoading ? (
            <div className="text-center text-[10px] text-muted-foreground py-2">
              Starting...
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "text-[11px]",
                  message.role === "user" ? "text-right" : "text-left"
                )}
              >
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    message.role === "user" &&
                      part.text.startsWith("[SYSTEM:") ? null : (
                      <div
                        key={i}
                        className={cn(
                          "inline-block rounded-lg px-2 py-1.5 max-w-[95%] whitespace-pre-wrap",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/60"
                        )}
                      >
                        {part.text}
                      </div>
                    )
                  ) : part.type === "tool-invocation" ? (
                    <div
                      key={i}
                      className="text-[9px] text-muted-foreground italic"
                    >
                      Updating spec...
                    </div>
                  ) : null
                )}
              </div>
            ))
          )}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-1 px-2 py-1.5 bg-muted/60 rounded-lg w-fit">
              <span className="size-1 animate-pulse rounded-full bg-foreground/40" />
              <span className="size-1 animate-pulse rounded-full bg-foreground/40 [animation-delay:150ms]" />
              <span className="size-1 animate-pulse rounded-full bg-foreground/40 [animation-delay:300ms]" />
            </div>
          )}
        </div>

        {/* Input - fixed at bottom */}
        <form onSubmit={handleSubmit} className="p-2 border-t shrink-0">
          <div className="flex gap-1.5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Answer..."
              disabled={isLoading}
              className="min-h-[32px] max-h-[60px] resize-none text-xs"
              rows={1}
            />
            <Button
              size="sm"
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-8 w-8 p-0"
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
