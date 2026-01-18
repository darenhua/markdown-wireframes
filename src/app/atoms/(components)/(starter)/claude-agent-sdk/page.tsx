"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { sendMessage } from "./actions";
import type { Message, StreamChunk } from "./types";

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function ClaudeAgentSDKPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    sessionId?: string;
    model?: string;
    lastCost?: number;
    lastDuration?: number;
  }>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const stream = await sendMessage({ prompt: userMessage.content });
      const reader = stream.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk: StreamChunk = JSON.parse(line);

            switch (chunk.type) {
              case "init":
                setSessionInfo((prev) => ({
                  ...prev,
                  sessionId: chunk.sessionId,
                  model: chunk.model,
                }));
                break;

              case "text":
                if (chunk.content) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: chunk.content!,
                    };
                    return updated;
                  });
                }
                break;

              case "result":
                setSessionInfo((prev) => ({
                  ...prev,
                  lastCost: chunk.cost,
                  lastDuration: chunk.duration,
                }));
                if (chunk.content) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (!updated[lastIdx].content) {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: chunk.content!,
                      };
                    }
                    return updated;
                  });
                }
                break;

              case "error":
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    content: `Error: ${chunk.error}`,
                  };
                  return updated;
                });
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          content: `Error: ${error instanceof Error ? error.message : "Failed to send message"}`,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col p-6">
      <Card className="flex flex-1 flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Claude Agent SDK Demo
            {sessionInfo.model && (
              <Badge variant="secondary" className="text-xs font-normal">
                {sessionInfo.model}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="flex items-center gap-4">
            <span>Streaming chat using @anthropic-ai/claude-agent-sdk</span>
            {sessionInfo.lastCost !== undefined && (
              <span className="text-xs">
                Cost: ${sessionInfo.lastCost.toFixed(4)} | Duration:{" "}
                {sessionInfo.lastDuration}ms
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4">
          <ScrollArea className="flex-1 rounded-md border p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <p className="text-muted-foreground text-center text-sm">
                  Start a conversation with Claude Agent
                </p>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">
                      {message.content}
                      {isLoading &&
                        message.role === "assistant" &&
                        message.id === messages[messages.length - 1]?.id &&
                        !message.content && (
                          <span className="animate-pulse">Thinking...</span>
                        )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? "Running..." : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
