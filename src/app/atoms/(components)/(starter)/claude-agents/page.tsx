"use client";

import { useState, useRef, useEffect } from "react";
import { useAgentStream, type ChatMessage, type ToolCall } from "./useAgentStream";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Send,
  Bot,
  User,
  FileText,
  Wrench,
  CheckCircle,
  XCircle,
  Loader2,
  FolderOpen,
  RefreshCw,
} from "lucide-react";

// Tool call display component
function ToolCallDisplay({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg p-2 bg-muted/30 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Wrench className="h-3 w-3 text-blue-500" />
        <span className="font-medium">{tool.name}</span>
        {tool.result !== undefined ? (
          <CheckCircle className="h-3 w-3 text-green-500 ml-auto" />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </button>
      {expanded && (
        <div className="mt-2 space-y-2">
          <div>
            <span className="text-muted-foreground">Input:</span>
            <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.result && (
            <div>
              <span className="text-muted-foreground">Result:</span>
              <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto max-h-32 overflow-y-auto">
                {tool.result.slice(0, 500)}
                {tool.result.length > 500 ? "..." : ""}
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

  return (
    <div
      className={cn(
        "flex gap-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          isSystem && "bg-red-100"
        )}
      >
        {isUser ? (
          <User className="h-3 w-3" />
        ) : isSystem ? (
          <XCircle className="h-3 w-3 text-red-500" />
        ) : (
          <Bot className="h-3 w-3" />
        )}
      </div>
      <div
        className={cn(
          "flex-1 space-y-2",
          isUser ? "text-right" : "text-left"
        )}
      >
        {message.content && (
          <div
            className={cn(
              "inline-block rounded-lg px-3 py-2 text-sm max-w-[85%]",
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
          <div className="space-y-2 max-w-[85%]">
            {message.toolCalls.map((tool, idx) => (
              <ToolCallDisplay key={idx} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaudeAgentsPage() {
  const [input, setInput] = useState("");
  const [pageName, setPageName] = useState("chartpage");
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isStreaming,
    error,
    currentToolCalls,
    send,
    cancel,
    clear,
  } = useAgentStream({
    onError: (err) => console.error("Agent error:", err),
    onMessage: (msg) => console.log("Agent message:", msg),
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentToolCalls]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    send(input, { pageName });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Example prompts
  const examplePrompts = [
    "Read the tree.json file and summarize what components exist",
    "Create a context.md file for the main card component",
    "What files are in this page directory?",
    "Update the Overview section of an existing context.md",
  ];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-semibold">Claude Agent SDK Demo</h1>
              <p className="text-xs text-muted-foreground">
                AI agent with file read/write capabilities
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {isStreaming ? "Working..." : "Ready"}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={isStreaming}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Page name input */}
        <div className="mt-3 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Working in:</span>
          <Input
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            placeholder="Page name (e.g., chartpage)"
            className="h-7 w-48 text-xs"
            disabled={isStreaming}
          />
          <span className="text-xs text-muted-foreground font-mono">
            outputs/{pageName}/
          </span>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-medium mb-2">
              Start a conversation with Claude
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              This agent can read files, write markdown specs, and help you
              document your UI components. It has access to the outputs directory.
            </p>

            {/* Example prompts */}
            <div className="grid grid-cols-2 gap-2 max-w-lg">
              {examplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => send(prompt, { pageName })}
                  className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors"
                >
                  <p className="text-xs">{prompt}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageDisplay key={message.id} message={message} />
        ))}

        {/* Show current tool calls while streaming */}
        {isStreaming && currentToolCalls.length > 0 && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-muted">
              <Bot className="h-3 w-3" />
            </div>
            <div className="flex-1 space-y-2">
              {currentToolCalls.map((tool, idx) => (
                <ToolCallDisplay key={idx} tool={tool} />
              ))}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isStreaming && currentToolCalls.length === 0 && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-muted">
              <Bot className="h-3 w-3" />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Claude to read files, write specs, or help document your components..."
              disabled={isStreaming}
              className="min-h-[60px] resize-none"
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            {isStreaming ? (
              <Button
                type="button"
                variant="outline"
                onClick={cancel}
                className="h-[60px] px-4"
              >
                Cancel
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                className="h-[60px] px-4"
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
            )}
          </div>
        </form>

        {/* Quick actions */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">Quick:</span>
          <button
            onClick={() => send("List all files in this directory", { pageName })}
            disabled={isStreaming}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            <FileText className="h-3 w-3 inline mr-1" />
            List files
          </button>
          <button
            onClick={() => send("Read the tree.json file", { pageName })}
            disabled={isStreaming}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            <FileText className="h-3 w-3 inline mr-1" />
            Read tree.json
          </button>
          <button
            onClick={() =>
              send(
                "Create a new context.md file in the components directory with a basic template",
                { pageName }
              )
            }
            disabled={isStreaming}
            className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            <FileText className="h-3 w-3 inline mr-1" />
            Create context.md
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute bottom-20 left-4 right-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error.message}</p>
        </div>
      )}
    </div>
  );
}
