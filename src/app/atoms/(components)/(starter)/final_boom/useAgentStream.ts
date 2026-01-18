"use client";

import { useState, useCallback, useRef } from "react";

// Message types from Claude Agent SDK
export interface AgentMessage {
  type: "system" | "assistant" | "result" | "user" | "error" | "stream_event";
  subtype?: string;
  uuid?: string;
  session_id?: string;
  message?: {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: unknown }
      | { type: "tool_result"; tool_use_id: string; content: string | Array<{ type: string; text?: string }> }
    >;
  };
  result?: string;
  error?: string;
  is_error?: boolean;
  duration_ms?: number;
  total_cost_usd?: number;
}

export interface ToolCall {
  id?: string;
  name: string;
  input: unknown;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

interface UseAgentStreamOptions {
  api?: string;
  onError?: (error: Error) => void;
  onMessage?: (message: AgentMessage) => void;
  onComplete?: () => void;
  onToolResult?: (toolName: string, result: string) => void;
}

export function useAgentStream(options: UseAgentStreamOptions = {}) {
  const { api = "/api/claude-agent", onError, onMessage, onComplete, onToolResult } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCall[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdCounter = useRef(0);

  const generateId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  const send = useCallback(
    async (
      prompt: string,
      context?: { pageName?: string; elementKey?: string; systemPrompt?: string }
    ) => {
      setIsStreaming(true);
      setError(null);
      setCurrentToolCalls([]);

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      let assistantContent = "";
      const toolCalls: ToolCall[] = [];

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            pageName: context?.pageName,
            elementKey: context?.elementKey,
            systemPrompt: context?.systemPrompt,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let buffer = "";

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

              if (data === "[DONE]") {
                continue;
              }

              try {
                const message = JSON.parse(data) as AgentMessage;
                onMessage?.(message);

                if (message.type === "assistant" && message.message?.content) {
                  for (const block of message.message.content) {
                    if (block.type === "text" && block.text) {
                      assistantContent += block.text;
                    } else if (block.type === "tool_use") {
                      toolCalls.push({
                        name: block.name,
                        input: block.input,
                        id: block.id,
                      });
                      setCurrentToolCalls([...toolCalls]);
                    }
                  }
                } else if (message.type === "user" && message.message?.content) {
                  for (const block of message.message.content) {
                    if (block.type === "tool_result") {
                      const matchingTool = toolCalls.find((t) => t.id === block.tool_use_id);
                      if (matchingTool) {
                        const resultContent = typeof block.content === "string"
                          ? block.content
                          : Array.isArray(block.content)
                          ? block.content.map((c) => c.text || "").join("\n")
                          : String(block.content);
                        matchingTool.result = resultContent;
                        setCurrentToolCalls([...toolCalls]);
                        onToolResult?.(matchingTool.name, resultContent);
                      }
                    }
                  }
                } else if (message.type === "result") {
                  if (message.is_error) {
                    console.error("Agent finished with error:", message);
                  }
                } else if (message.type === "error") {
                  throw new Error(message.error || "Agent error");
                }
              } catch (parseError) {
                console.warn("Failed to parse SSE data:", data, parseError);
              }
            }
          }
        }

        // Add final assistant message
        if (assistantContent || toolCalls.length > 0) {
          const assistantMessage: ChatMessage = {
            id: generateId(),
            role: "assistant",
            content: assistantContent,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        onComplete?.();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);

        const errorMessage: ChatMessage = {
          id: generateId(),
          role: "system",
          content: `Error: ${error.message}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreaming(false);
        setCurrentToolCalls([]);
        abortControllerRef.current = null;
      }
    },
    [api, onError, onMessage, onComplete, onToolResult]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
    setCurrentToolCalls([]);
  }, []);

  return {
    messages,
    isStreaming,
    error,
    currentToolCalls,
    send,
    cancel,
    clear,
  };
}
