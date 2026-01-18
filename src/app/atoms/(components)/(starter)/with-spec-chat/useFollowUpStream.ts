"use client";

import { useState, useCallback, useRef } from "react";

type UITree = {
  root: string | null;
  elements: Record<string, any>;
};

type UseFollowUpStreamOptions = {
  api: string;
  onError?: (err: Error) => void;
  onComplete?: (tree: UITree) => void;
};

// Parse response into JSON patches section
function parseResponse(text: string): { json: string } {
  const parts = text.split("---");
  if (parts.length >= 2) {
    return { json: parts[0].trim() };
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.includes('{"op":')) {
    return { json: trimmed };
  }
  return { json: "" };
}

// Apply JSONL patches to a tree
function applyPatches(tree: UITree, jsonl: string): UITree {
  if (!jsonl || !jsonl.trim()) return tree;

  const newTree = { ...tree, elements: { ...tree.elements } };
  const lines = jsonl.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    try {
      const patch = JSON.parse(line);
      if (patch.op === "set") {
        if (patch.path === "/root") {
          newTree.root = patch.value;
        } else if (patch.path.startsWith("/elements/")) {
          const key = patch.path.replace("/elements/", "");
          newTree.elements[key] = patch.value;
        }
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }

  return newTree;
}

export function useFollowUpStream(options: UseFollowUpStreamOptions) {
  const { api, onError, onComplete } = options;
  const [tree, setTree] = useState<UITree | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (prompt: string, opts?: { currentTree?: UITree }) => {
      const currentTree = opts?.currentTree ?? { root: null, elements: {} };

      // Abort any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setError(null);
      setTree(currentTree);

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "chat",
            messages: [{ role: "user", content: prompt }],
            currentTree,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No reader available");

        const decoder = new TextDecoder();
        let fullContent = "";
        let currentTreeState = currentTree;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // Strip token metadata for processing
          const contentWithoutTokens = fullContent.replace(/\n\[\[TOKENS:.*\]\]$/, "");

          // Apply JSON patches to tree as they stream
          const { json } = parseResponse(contentWithoutTokens);
          if (json) {
            currentTreeState = applyPatches(currentTreeState, json);
            setTree(currentTreeState);
          }
        }

        setIsStreaming(false);
        onComplete?.(currentTreeState);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsStreaming(false);
        onError?.(error);
      }
    },
    [api, onError, onComplete]
  );

  const clear = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setTree(null);
    setIsStreaming(false);
    setError(null);
  }, []);

  return { tree, isStreaming, error, send, clear };
}
