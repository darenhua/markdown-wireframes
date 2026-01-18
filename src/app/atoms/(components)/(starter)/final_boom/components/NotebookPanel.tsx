"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAgentStream, type ChatMessage, type ToolCall } from "../useAgentStream";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Send,
  FileText,
  RefreshCw,
  ChevronLeft,
  Wrench,
  CheckCircle,
  Loader2,
  Bot,
  User,
  XCircle,
} from "lucide-react";
import { readElementContext, type SelectorInfo } from "../spec-actions";
import { readPageTsx } from "../actions";

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

// Tool call display component
function ToolCallDisplay({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded p-1.5 bg-muted/30 text-[10px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <Wrench className="h-2.5 w-2.5 text-blue-500" />
        <span className="font-medium truncate">{tool.name}</span>
        {tool.result !== undefined ? (
          <CheckCircle className="h-2.5 w-2.5 text-green-500 ml-auto flex-shrink-0" />
        ) : (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground ml-auto flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          <div>
            <span className="text-muted-foreground">Input:</span>
            <pre className="mt-0.5 p-1 bg-background rounded text-[8px] overflow-x-auto">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.result && (
            <div>
              <span className="text-muted-foreground">Result:</span>
              <pre className="mt-0.5 p-1 bg-background rounded text-[8px] overflow-x-auto max-h-16 overflow-y-auto">
                {tool.result.slice(0, 200)}
                {tool.result.length > 200 ? "..." : ""}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Message display component
function MessageDisplay({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  // Hide system messages that start with [SYSTEM:
  if (isUser && message.content.startsWith("[SYSTEM:")) {
    return null;
  }

  return (
    <div className={cn("flex gap-1.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          isSystem && "bg-red-100"
        )}
      >
        {isUser ? (
          <User className="h-2.5 w-2.5" />
        ) : isSystem ? (
          <XCircle className="h-2.5 w-2.5 text-red-500" />
        ) : (
          <Bot className="h-2.5 w-2.5" />
        )}
      </div>
      <div className={cn("flex-1 space-y-1", isUser ? "text-right" : "text-left")}>
        {message.content && (
          <div
            className={cn(
              "inline-block rounded-lg px-2 py-1 text-[11px] max-w-[90%]",
              isUser
                ? "bg-primary text-primary-foreground"
                : isSystem
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-muted"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1 max-w-[90%]">
            {message.toolCalls.map((tool, idx) => (
              <ToolCallDisplay key={idx} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
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
  const [pageTsxContent, setPageTsxContent] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [selectedInternalKey, setSelectedInternalKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);
  const prevElementKey = useRef<string | null>(null);
  const contextLoadedRef = useRef(false);
  // Force re-render when context loads
  const [, forceUpdate] = useState({});

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
    clear();
    hasAutoStarted.current = false;
  };

  // Build selector info from element
  const selectors: SelectorInfo | undefined = element
    ? {
        elementKey: elementKey || undefined,
        textContent: (element.props?.label || element.props?.text || element.props?.title) as string | undefined,
      }
    : undefined;

  // Fetch context and page.tsx from server
  const fetchContext = useCallback(async () => {
    if (!elementKey) return;
    contextLoadedRef.current = false;
    const [content, pageContent] = await Promise.all([
      readElementContext(pageName, elementKey),
      readPageTsx(pageName),
    ]);
    setContextContent(content);
    setPageTsxContent(pageContent);
    contextLoadedRef.current = true;
    onContextUpdate(content);
    forceUpdate({}); // Trigger re-render to check auto-start condition
  }, [pageName, elementKey, onContextUpdate]);

  // Agent stream hook
  const {
    messages,
    isStreaming,
    error,
    currentToolCalls,
    send,
    cancel,
    clear,
  } = useAgentStream({
    api: "/api/claude-agent",
    onError: (err) => console.error("Agent error:", err),
    onComplete: () => {
      // Refetch context when agent completes
      fetchContext();
    },
    onToolResult: (toolName, result) => {
      // Refetch context when Write tool completes
      if (toolName === "Write" || toolName === "Edit") {
        fetchContext();
      }
    },
  });

  // Reset when element changes
  useEffect(() => {
    if (elementKey !== prevElementKey.current) {
      prevElementKey.current = elementKey;
      clear();
      hasAutoStarted.current = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Sync state when elementKey prop changes
      fetchContext();
    }
  }, [elementKey, clear, fetchContext]);

  // AUTO-START: Send initial greeting when element is selected and no messages
  useEffect(() => {
    if (
      elementKey &&
      element &&
      contextLoadedRef.current &&
      messages.length === 0 &&
      !hasAutoStarted.current &&
      !isStreaming
    ) {
      hasAutoStarted.current = true;
      console.log("[NotebookPanel] Auto-start with:", {
        pageName,
        elementKey,
        hasTree: !!tree,
        element,
      });

      // Build preloaded context for the system prompt
      const treeContext = tree ? JSON.stringify(tree, null, 2) : "Not available";
      const pageContext = pageTsxContent || "Not available";
      const specContext = contextContent || "No existing spec - this is a new component";

      const systemPrompt = `You are helping the user fill out a component specification for "${elementKey}" (type: ${element.type}).
The spec file is located at: outputs/${pageName}/components/${elementKey}/context.md

## PRELOADED CONTEXT (do NOT use tools to read these files - they are provided below):

### Current Component Spec (context.md):
\`\`\`markdown
${specContext}
\`\`\`

### Component Tree (tree.json):
\`\`\`json
${treeContext}
\`\`\`

### Page Implementation (page.tsx):
\`\`\`tsx
${pageContext}
\`\`\`

## INSTRUCTIONS:
- You already have access to all the context above - do NOT call Read tools to fetch tree.json, page.tsx, or context.md
- Ask the user ONE question at a time to fill in missing sections of the spec
- Keep responses brief and conversational
- When the user answers, use the Write tool to update the context.md file with their input
- Focus on: Overview, Purpose, Features, Interactions, and Edge Cases sections`;

      send(
        `Let's fill out the spec for the "${elementKey}" component. What would you like to know about it first?`,
        { pageName, elementKey, systemPrompt }
      );
    }
  }, [elementKey, element, messages.length, isStreaming, send, pageName, tree, pageTsxContent, contextContent]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentToolCalls]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input, { pageName, elementKey: elementKey || undefined });
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
      {/* Spec Preview (top) */}
      <div className="shrink-0 border-b">
        <div className="px-2 py-1 flex items-center justify-between bg-muted/30">
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
        <div className="h-[70px] overflow-y-auto">
          <div className="p-2">
            {contextContent ? (
              <pre className="text-[9px] text-muted-foreground whitespace-pre-wrap font-mono leading-tight">
                {contextContent.slice(0, 400)}
                {contextContent.length > 400 ? "..." : ""}
              </pre>
            ) : (
              <p className="text-[9px] text-muted-foreground/60 italic">
                No spec yet - answer questions below to build it
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chat (bottom) */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
          {messages.length === 0 && !isStreaming ? (
            <div className="text-center text-[10px] text-muted-foreground py-2">
              Starting conversation...
            </div>
          ) : (
            messages.map((message) => (
              <MessageDisplay key={message.id} message={message} />
            ))
          )}

          {/* Current tool calls while streaming */}
          {isStreaming && currentToolCalls.length > 0 && (
            <div className="flex gap-1.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-2.5 w-2.5" />
              </div>
              <div className="flex-1 space-y-1">
                {currentToolCalls.map((tool, idx) => (
                  <ToolCallDisplay key={idx} tool={tool} />
                ))}
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isStreaming && currentToolCalls.length === 0 && (
            <div className="flex gap-1.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-muted">
                <Bot className="h-2.5 w-2.5" />
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-[10px] text-muted-foreground">Thinking...</span>
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
            {isStreaming ? (
              <Button size="sm" type="button" variant="outline" onClick={cancel} className="h-8 w-8 p-0">
                <XCircle className="h-3 w-3" />
              </Button>
            ) : (
              <Button size="sm" type="submit" disabled={!input.trim()} className="h-8 w-8 p-0">
                <Send className="h-3 w-3" />
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute bottom-16 left-2 right-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-800">
          {error.message}
        </div>
      )}
    </div>
  );
}
