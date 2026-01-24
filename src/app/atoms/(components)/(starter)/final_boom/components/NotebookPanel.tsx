"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSpecChat } from "../useSpecChat";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send,
  FileText,
  RefreshCw,
  ChevronLeft,
  Loader2,
  Bot,
  User,
} from "lucide-react";
import { readElementContext } from "../spec-actions";

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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedInternalKey, setSelectedInternalKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);
  const prevElementKey = useRef<string | null>(null);
  const messageIdCounter = useRef(0);

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

  const generateId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  // Spec chat hook - now with separate question and markdown streams
  const { sendMessage, isStreaming, streamedQuestion, streamedMarkdown, clear } = useSpecChat({
    onComplete: (question, markdown) => {
      // Update context with the returned markdown
      setContextContent(markdown);
      onContextUpdate(markdown);

      // Add assistant message with the question
      if (question) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "assistant",
            content: question,
          },
        ]);
      }
    },
  });

  // Handle manual element selection
  const handleElementSelect = (key: string) => {
    setSelectedInternalKey(key);
    onElementKeyChange?.(key);
  };

  // Go back to selector
  const handleBack = () => {
    setSelectedInternalKey(null);
    onElementKeyChange?.("");
    setMessages([]);
    clear();
    hasAutoStarted.current = false;
  };

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
      clear();
      hasAutoStarted.current = false;
      fetchContext();
    }
  }, [elementKey, clear, fetchContext]);

  // AUTO-START: Send initial message when element is selected
  useEffect(() => {
    if (
      elementKey &&
      element &&
      messages.length === 0 &&
      !hasAutoStarted.current &&
      !isStreaming
    ) {
      hasAutoStarted.current = true;

      // Add initial user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: `Let's define the spec for "${elementKey}"`,
      };
      setMessages([userMessage]);

      // Send to API
      sendMessage(userMessage.content, {
        currentContext: contextContent,
        elementKey,
        elementType: element.type,
      });
    }
  }, [elementKey, element, messages.length, isStreaming, sendMessage, contextContent]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamedQuestion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !elementKey || !element) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Send to API
    sendMessage(input.trim(), {
      currentContext: contextContent,
      elementKey,
      elementType: element.type,
    });

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

  // Show element selector
  if (!elementKey && tree && elementOptions.length > 0) {
    return (
      <div className="flex flex-col h-full p-2">
        <p className="text-[10px] text-muted-foreground mb-2">Select component:</p>
        <div className="space-y-1">
          {elementOptions.slice(0, 4).map((opt) => (
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
          {elementOptions.length > 4 && (
            <p className="text-[9px] text-muted-foreground/60 px-2">
              +{elementOptions.length - 4} more
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main chat view
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Spec Preview (top) - takes 50% */}
      <div className="flex-1 min-h-0 flex flex-col border-b">
        <div className="px-2 py-1 flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-1.5">
            <button onClick={handleBack} className="p-0.5 hover:bg-muted rounded">
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            </button>
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {elementKey}
            </span>
          </div>
          <button onClick={fetchContext} className="p-0.5 hover:bg-muted rounded">
            <RefreshCw className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-2">
            {/* Show streaming markdown if available, otherwise show saved context */}
            {isStreaming && streamedMarkdown ? (
              <pre className="text-[9px] text-foreground whitespace-pre-wrap font-mono leading-tight">
                {streamedMarkdown}
              </pre>
            ) : contextContent ? (
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

      {/* Chat (bottom) - takes 50% */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
          {messages.length === 0 && !isStreaming ? (
            <div className="text-center text-[10px] text-muted-foreground py-2">
              Starting conversation...
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-1.5",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div
                  className={cn(
                    "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="h-2.5 w-2.5" />
                  ) : (
                    <Bot className="h-2.5 w-2.5" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1",
                    message.role === "user" ? "text-right" : "text-left"
                  )}
                >
                  <div
                    className={cn(
                      "inline-block rounded-lg px-2 py-1 text-[11px] max-w-[90%]",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Streaming question indicator */}
          {isStreaming && (
            <div className="flex gap-1.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-2.5 w-2.5" />
              </div>
              <div className="flex-1 text-left">
                {streamedQuestion ? (
                  <div className="inline-block rounded-lg px-2 py-1 text-[11px] max-w-[90%] bg-muted">
                    <p className="whitespace-pre-wrap">{streamedQuestion}</p>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[10px] text-muted-foreground">Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
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
              disabled={isStreaming}
              className="min-h-[32px] max-h-[60px] resize-none text-xs"
              rows={1}
            />
            <Button size="sm" type="submit" disabled={!input.trim() || isStreaming} className="h-8 w-8 p-0">
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
