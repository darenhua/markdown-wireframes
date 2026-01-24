"use client";

import { useState, useCallback, useRef } from "react";

interface UseSpecChatOptions {
  onComplete?: (question: string, markdown: string) => void;
}

type StreamSection = "none" | "question" | "markdown";

export function useSpecChat(options: UseSpecChatOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedQuestion, setStreamedQuestion] = useState("");
  const [streamedMarkdown, setStreamedMarkdown] = useState("");
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sendMessage = useCallback(
    async (
      userMessage: string,
      context: {
        currentContext: string;
        elementKey: string;
        elementType: string;
      }
    ) => {
      setIsStreaming(true);
      setStreamedQuestion("");
      setStreamedMarkdown("");

      try {
        const response = await fetch("/api/spec-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage,
            currentContext: context.currentContext,
            elementKey: context.elementKey,
            elementType: context.elementType,
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader");

        const decoder = new TextDecoder();
        let fullText = "";
        let currentSection: StreamSection = "none";
        let questionBuffer = "";
        let markdownBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          // Parse the accumulated text to find sections
          // Look for delimiters and extract content
          const questionStart = fullText.indexOf("---QUESTION---");
          const markdownStart = fullText.indexOf("---MARKDOWN---");
          const endMarker = fullText.indexOf("---END---");

          if (questionStart !== -1) {
            const questionEnd = markdownStart !== -1 ? markdownStart : fullText.length;
            questionBuffer = fullText.slice(questionStart + 14, questionEnd).trim();
            setStreamedQuestion(questionBuffer);
            currentSection = "question";
          }

          if (markdownStart !== -1) {
            const markdownEnd = endMarker !== -1 ? endMarker : fullText.length;
            markdownBuffer = fullText.slice(markdownStart + 14, markdownEnd).trim();
            setStreamedMarkdown(markdownBuffer);
            currentSection = "markdown";
          }
        }

        // Final parse to get clean values
        const finalQuestionStart = fullText.indexOf("---QUESTION---");
        const finalMarkdownStart = fullText.indexOf("---MARKDOWN---");
        const finalEnd = fullText.indexOf("---END---");

        let finalQuestion = "";
        let finalMarkdown = "";

        if (finalQuestionStart !== -1 && finalMarkdownStart !== -1) {
          finalQuestion = fullText.slice(finalQuestionStart + 14, finalMarkdownStart).trim();
        }

        if (finalMarkdownStart !== -1) {
          const endPos = finalEnd !== -1 ? finalEnd : fullText.length;
          finalMarkdown = fullText.slice(finalMarkdownStart + 14, endPos).trim();
        }

        setStreamedQuestion(finalQuestion);
        setStreamedMarkdown(finalMarkdown);
        optionsRef.current.onComplete?.(finalQuestion, finalMarkdown);

        return { question: finalQuestion, markdown: finalMarkdown };
      } catch (error) {
        console.error("Spec chat error:", error);
        throw error;
      } finally {
        setIsStreaming(false);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setStreamedQuestion("");
    setStreamedMarkdown("");
  }, []);

  return {
    sendMessage,
    isStreaming,
    streamedQuestion,
    streamedMarkdown,
    clear,
  };
}
