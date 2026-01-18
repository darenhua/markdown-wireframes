"use client";

import { useState } from "react";
import {
  Renderer,
  DataProvider,
  VisibilityProvider,
  ActionProvider,
} from "@json-render/react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { registry } from "../try-jsonrender/registry";

const EXAMPLE_PROMPTS = [
  "Create a welcome card with a greeting and get started button",
  "Build a metrics dashboard with revenue, users, and growth stats",
  "Design a contact form with name, email, and message fields",
  "Create a pricing card with features list and subscribe button",
];

const EVALUATOR_PROMPTS: Record<string, string> = {
  mergeSimple: `You are a UI quality evaluator. Given three JSON outputs from different AI models, merge them into ONE optimal output.

Take the best elements from each and create a single, valid JSONL output.

Respond with ONLY valid JSONL (no explanation, no markdown).`,

  mergeStructured: `You are a UI quality evaluator. Given three JSON outputs from different AI models for the same UI request, CREATE AN OPTIMAL MERGED OUTPUT.

MERGE CRITERIA:
1. Structure: Use the most logical component hierarchy from any output
2. Completeness: Include all UI elements the user requested
3. Props: Choose the best prop values (labels, variants, etc.)
4. Layout: Prefer outputs with proper spacing (Stack/Grid with gaps)

PROCESS:
1. Identify the best root structure
2. For each component type, pick the best implementation
3. Combine into valid JSONL

Respond with ONLY valid JSONL (no explanation, no markdown).`,

  mergeWeighted: `You are a UI quality evaluator. Given three JSON outputs from different AI models, create a merged output using weighted selection.

SCORING (internal, don't output):
- Score each output's JSON validity (0-10)
- Score each output's completeness (0-10)
- Score each output's UX quality (0-10)

MERGE APPROACH:
- Use structure from highest-scoring output as base
- Cherry-pick better component implementations from others
- Fix any issues found in individual outputs

Respond with ONLY the final merged JSONL (no scores, no explanation, no markdown).`,

  mergeConsensus: `You are a UI quality evaluator. Given three JSON outputs from different AI models, merge using CONSENSUS patterns.

CONSENSUS RULES:
1. If 2+ outputs use the same component type for an element, use that type
2. If 2+ outputs use similar structure, follow that structure
3. For props, prefer values that appear in multiple outputs
4. If no consensus, pick the most complete/correct option

OUTPUT:
- Valid JSONL combining consensus decisions
- Include all elements the user requested

Respond with ONLY valid JSONL (no explanation, no markdown).`,
};

const EVALUATOR_VARIANTS = [
  { value: "mergeSimple", label: "Simple", description: "Minimal merge instructions" },
  { value: "mergeStructured", label: "Structured", description: "Explicit criteria & process" },
  { value: "mergeWeighted", label: "Weighted", description: "Score then combine best" },
  { value: "mergeConsensus", label: "Consensus", description: "Use majority patterns" },
] as const;

type PreviewSource = "merged" | "A" | "B" | "C";

type EvaluatorVariant = (typeof EVALUATOR_VARIANTS)[number]["value"];

type TokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type GeneratorOutput = {
  model: string;
  outputLength: number;
  usage: TokenUsage | null;
};

type ResponseMetadata = {
  evaluatorVariant: string;
  timing: {
    generatorsMs: number;
    evaluatorMs: number;
    totalMs: number;
  };
  generators: {
    A: GeneratorOutput;
    B: GeneratorOutput;
    C: GeneratorOutput;
  };
  evaluator: {
    model: string;
    usage: TokenUsage | null;
  };
};

type UITree = {
  root: string | null;
  elements: Record<string, unknown>;
};

// Apply JSONL patches to a tree
function applyPatches(tree: UITree, jsonl: string): UITree {
  if (!jsonl || !jsonl.trim()) return tree;

  // Clean up markdown code blocks that models sometimes add
  let cleaned = jsonl
    .replace(/```json\n?/g, "")
    .replace(/```jsonl\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const newTree = { ...tree, elements: { ...tree.elements } };
  const lines = cleaned.split("\n").filter((line) => line.trim());

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
      console.warn("Failed to parse patch:", line, e);
    }
  }

  return newTree;
}

export default function EnsembleChatPage() {
  const [input, setInput] = useState("");
  const [evaluatorVariant, setEvaluatorVariant] = useState<EvaluatorVariant>("mergeSimple");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ResponseMetadata | null>(null);
  const [rawOutputs, setRawOutputs] = useState<{
    A: string;
    B: string;
    C: string;
    evaluatorFull: string;
  } | null>(null);
  const [trees, setTrees] = useState<{
    merged: UITree;
    A: UITree;
    B: UITree;
    C: UITree;
  }>({
    merged: { root: null, elements: {} },
    A: { root: null, elements: {} },
    B: { root: null, elements: {} },
    C: { root: null, elements: {} },
  });
  const [previewSource, setPreviewSource] = useState<PreviewSource>("merged");
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setMetadata(null);
    setRawOutputs(null);
    setTrees({
      merged: { root: null, elements: {} },
      A: { root: null, elements: {} },
      B: { root: null, elements: {} },
      C: { root: null, elements: {} },
    });
    setPreviewSource("merged");

    try {
      const response = await fetch("/api/ensemble-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input,
          evaluatorVariant,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch response");
      }

      const data = await response.json();
      setResult(data.result);
      setMetadata(data.metadata);
      setRawOutputs(data.rawOutputs);

      // Build trees for each output
      const emptyTree: UITree = { root: null, elements: {} };
      setTrees({
        merged: data.result ? applyPatches(emptyTree, data.result) : emptyTree,
        A: data.rawOutputs?.A ? applyPatches(emptyTree, data.rawOutputs.A) : emptyTree,
        B: data.rawOutputs?.B ? applyPatches(emptyTree, data.rawOutputs.B) : emptyTree,
        C: data.rawOutputs?.C ? applyPatches(emptyTree, data.rawOutputs.C) : emptyTree,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setInput(example);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Build the tree for the Renderer based on selected preview source
  const currentTree = trees[previewSource];
  const renderTree = currentTree.root ? { root: currentTree.root, elements: currentTree.elements } : null;

  // Get model name for current preview
  const previewModelName = previewSource === "merged"
    ? "Merged Output"
    : metadata?.generators[previewSource]?.model || previewSource;

  // Calculate total tokens across all calls
  const totalTokens = metadata
    ? (metadata.generators.A.usage?.totalTokens || 0) +
      (metadata.generators.B.usage?.totalTokens || 0) +
      (metadata.generators.C.usage?.totalTokens || 0) +
      (metadata.evaluator.usage?.totalTokens || 0)
    : 0;

  return (
    <div className="flex h-screen bg-background">
      {/* Left side - Input and Controls */}
      <div className="relative flex w-1/2 flex-col border-r border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] via-transparent to-transparent" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
              <svg
                className="size-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-medium tracking-tight">
                Ensemble UI Generator
              </h1>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Generating with 3 models..." : "3 models + evaluator"}
              </p>
            </div>
          </div>

          {/* Token counter */}
          {totalTokens > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
              <svg
                className="size-3.5 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
              <div className="text-xs">
                <span className="font-medium text-foreground">
                  {totalTokens.toLocaleString()}
                </span>
                <span className="text-muted-foreground ml-1">tokens</span>
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <ScrollArea className="relative z-10 flex-1 px-6 py-4">
          <div className="space-y-6">
            {/* Prompt Input */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-emerald-500/30 focus-within:shadow-md focus-within:shadow-emerald-500/5">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the UI you want to create..."
                  disabled={isLoading}
                  className="min-h-[100px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm focus-visible:ring-0 disabled:opacity-50"
                  rows={4}
                />
                <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground/60">
                    Press Enter to generate
                  </p>
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                      input.trim() && !isLoading
                        ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                        : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                  >
                    {isLoading ? (
                      <>
                        <svg className="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
                        Generating...
                      </>
                    ) : (
                      <>Generate</>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Evaluator Variant Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Evaluator Strategy (A/B Test)
                </p>
                <button
                  onClick={() => setShowPrompt(!showPrompt)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700"
                >
                  {showPrompt ? "Hide" : "Show"} Prompt
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {EVALUATOR_VARIANTS.map((variant) => (
                  <button
                    key={variant.value}
                    onClick={() => setEvaluatorVariant(variant.value)}
                    disabled={isLoading}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-50",
                      evaluatorVariant === variant.value
                        ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:border-emerald-500/30 hover:bg-muted/50"
                    )}
                  >
                    <p className="text-xs font-medium">{variant.label}</p>
                    <p className="text-[10px] text-muted-foreground">{variant.description}</p>
                  </button>
                ))}
              </div>
              {/* Show System Prompt */}
              {showPrompt && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-[10px] font-medium text-emerald-600 uppercase tracking-wide mb-2">
                    System Prompt for "{EVALUATOR_VARIANTS.find(v => v.value === evaluatorVariant)?.label}"
                  </p>
                  <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {EVALUATOR_PROMPTS[evaluatorVariant]}
                  </pre>
                </div>
              )}
            </div>

            {/* Example Prompts */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Try an example
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    disabled={isLoading}
                    className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-emerald-500/30 hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Results Metadata */}
            {metadata && (
              <div className="space-y-4">
                {/* Timing */}
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Performance
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {metadata.timing.generatorsMs}ms
                      </p>
                      <p className="text-[10px] text-muted-foreground">3 Generators (parallel)</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-foreground">
                        {metadata.timing.evaluatorMs}ms
                      </p>
                      <p className="text-[10px] text-muted-foreground">Evaluator</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-emerald-600">
                        {metadata.timing.totalMs}ms
                      </p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>

                {/* Model Outputs */}
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    Generator Outputs
                  </p>
                  <div className="space-y-2">
                    {(["A", "B", "C"] as const).map((key) => {
                      const gen = metadata.generators[key];
                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              {key}:
                            </span>
                            <span className="text-xs text-foreground">{gen.model}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{gen.outputLength} chars</span>
                            {gen.usage?.totalTokens && (
                              <span>{gen.usage.totalTokens} tokens</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-emerald-600">Evaluator:</span>
                        <span className="text-xs text-foreground">{metadata.evaluator.model}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {metadata.evaluator.usage?.totalTokens && (
                          <span>{metadata.evaluator.usage.totalTokens} tokens</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw Outputs Toggle */}
                {rawOutputs && (
                  <details className="rounded-lg border border-border/60 bg-muted/30">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Raw Outputs (click to expand)
                    </summary>
                    <div className="border-t border-border/40 p-4 space-y-3">
                      {(["A", "B", "C"] as const).map((key) => (
                        <div key={key}>
                          <p className="text-[10px] font-medium text-muted-foreground mb-1">
                            Output {key} ({metadata.generators[key].model}):
                          </p>
                          <pre className="overflow-auto rounded bg-background p-2 text-[9px] text-muted-foreground max-h-32">
                            {rawOutputs[key] || "[No output]"}
                          </pre>
                        </div>
                      ))}
                      <div>
                        <p className="text-[10px] font-medium text-emerald-600 mb-1">
                          Evaluator Response:
                        </p>
                        <pre className="overflow-auto rounded bg-background p-2 text-[9px] text-muted-foreground max-h-32">
                          {rawOutputs.evaluatorFull}
                        </pre>
                      </div>
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right side - Preview */}
      <div className="flex w-1/2 flex-col bg-muted/20">
        <header className="flex flex-col gap-3 border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-2">
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
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h2 className="text-sm font-medium tracking-tight">Preview</h2>
            <span className="text-xs text-muted-foreground">— {previewModelName}</span>
            {isLoading && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Generating...
              </span>
            )}
          </div>
          {/* Preview Source Toggle */}
          {rawOutputs && (
            <div className="flex gap-1">
              {(["merged", "A", "B", "C"] as const).map((source) => {
                const label = source === "merged"
                  ? "Merged"
                  : metadata?.generators[source]?.model?.split("-")[0] || source;
                const isActive = previewSource === source;
                const hasContent = source === "merged"
                  ? trees.merged.root !== null
                  : trees[source].root !== null;

                return (
                  <button
                    key={source}
                    onClick={() => setPreviewSource(source)}
                    disabled={!hasContent}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                      isActive
                        ? source === "merged"
                          ? "bg-emerald-600 text-white"
                          : "bg-foreground text-background"
                        : hasContent
                          ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                          : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed"
                    )}
                  >
                    {source === "merged" ? "✨ Merged" : label}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <ScrollArea className="flex-1 p-6">
          {renderTree ? (
            <DataProvider>
              <VisibilityProvider>
                <ActionProvider>
                  <div className="space-y-4">
                    <Renderer
                      tree={renderTree as Parameters<typeof Renderer>[0]["tree"]}
                      registry={registry}
                    />
                  </div>
                </ActionProvider>
              </VisibilityProvider>
            </DataProvider>
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
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No preview yet</p>
              <p className="mt-1 max-w-[200px] text-xs text-muted-foreground/60">
                3 AI models will generate UI, then an evaluator picks the best
              </p>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
