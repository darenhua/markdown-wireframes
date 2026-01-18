"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { UITree, UIElement, JsonPatch } from "@json-render/core";
import { setByPath } from "@json-render/core";

/**
 * Options for useFollowUpStream
 */
interface UseFollowUpStreamOptions {
  /** API endpoint */
  api: string;
  /** Callback when complete */
  onComplete?: (tree: UITree) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Return type for useFollowUpStream
 */
interface UseFollowUpStreamReturn {
  /** Current UI tree */
  tree: UITree | null;
  /** Whether currently streaming */
  isStreaming: boolean;
  /** Error if any */
  error: Error | null;
  /** Send a prompt to generate/modify UI */
  send: (prompt: string, context?: { currentTree?: UITree }) => Promise<void>;
  /** Clear the current tree */
  clear: () => void;
}

/**
 * Parse a single line of JSONL into a patch object
 */
function parsePatchLine(line: string): JsonPatch | null {
  try {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      return null;
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Apply a patch to a UITree immutably
 */
function applyPatch(tree: UITree, patch: JsonPatch): UITree {
  const newTree = { ...tree, elements: { ...tree.elements } };

  switch (patch.op) {
    case "set":
    case "add":
    case "replace": {
      if (patch.path === "/root") {
        newTree.root = patch.value as string;
        return newTree;
      }

      if (patch.path.startsWith("/elements/")) {
        const pathParts = patch.path.slice("/elements/".length).split("/");
        const elementKey = pathParts[0];

        if (!elementKey) return newTree;

        if (pathParts.length === 1) {
          // Set entire element: /elements/key
          newTree.elements[elementKey] = patch.value as UIElement;
        } else {
          // Set nested property: /elements/key/props/title
          const element = newTree.elements[elementKey];
          if (element) {
            const propPath = "/" + pathParts.slice(1).join("/");
            const newElement = { ...element };
            setByPath(newElement as Record<string, unknown>, propPath, patch.value);
            newTree.elements[elementKey] = newElement;
          }
        }
      }
      break;
    }

    case "remove": {
      if (patch.path.startsWith("/elements/")) {
        const elementKey = patch.path.slice("/elements/".length).split("/")[0];
        if (elementKey) {
          const { [elementKey]: _, ...rest } = newTree.elements;
          newTree.elements = rest;
        }
      }
      break;
    }
  }

  return newTree;
}

/**
 * Custom streaming hook that supports starting from an existing tree.
 *
 * Unlike useUIStream which always starts from an empty tree, this hook
 * will use context.currentTree as the starting point when provided.
 * This enables smooth follow-up modifications where unchanged elements
 * remain visible while only the changes stream in.
 */
export function useFollowUpStream({
  api,
  onComplete,
  onError,
}: UseFollowUpStreamOptions): UseFollowUpStreamReturn {
  const [tree, setTree] = useState<UITree | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    setTree(null);
    setError(null);
  }, []);

  const send = useCallback(
    async (prompt: string, context?: { currentTree?: UITree }) => {
      // Abort any previous request
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setError(null);

      // KEY DIFFERENCE: Start from context.currentTree if provided, not empty
      // This preserves existing elements while streaming in changes
      let currentTree: UITree = context?.currentTree
        ? {
            root: context.currentTree.root,
            elements: { ...context.currentTree.elements },
          }
        : { root: "", elements: {} };

      setTree(currentTree);

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            context,
            currentTree,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const patch = parsePatchLine(line);
            if (patch) {
              currentTree = applyPatch(currentTree, patch);
              setTree({ ...currentTree });
            }
          }
        }

        // Handle final buffer content
        if (buffer.trim()) {
          const patch = parsePatchLine(buffer);
          if (patch) {
            currentTree = applyPatch(currentTree, patch);
            setTree({ ...currentTree });
          }
        }

        onComplete?.(currentTree);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsStreaming(false);
      }
    },
    [api, onComplete, onError]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    tree,
    isStreaming,
    error,
    send,
    clear,
  };
}
