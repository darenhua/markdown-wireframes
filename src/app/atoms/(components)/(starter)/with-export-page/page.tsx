"use client";

import { useState, useEffect, useCallback } from "react";
import { Renderer, useUIStream, DataProvider, VisibilityProvider, ActionProvider } from "@json-render/react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { registry } from "./registry";
import { exportTreeToFolder, readOutputsDirectory } from "./actions";
import type { FileSystemNode } from "./types";

const EXAMPLE_PROMPTS = [
  "Create a welcome card with a greeting and get started button",
  "Build a metrics dashboard with revenue, users, and growth stats",
  "Design a contact form with name, email, and message fields",
  "Create a pricing card with features list and subscribe button",
];

// ============ ICONS ============
function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open ? (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      )}
    </svg>
  );
}

function FileIcon({ type }: { type?: "page" | "json" | "default" }) {
  const colors = { page: "text-blue-400", json: "text-yellow-400", default: "text-gray-400" };
  return (
    <svg className={cn("size-4", colors[type || "default"])} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={cn("size-3 transition-transform", expanded && "rotate-90")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ============ EXPORT MODAL ============
interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (folderName: string) => Promise<void>;
  isExporting: boolean;
}

function ExportModal({ isOpen, onClose, onExport, isExporting }: ExportModalProps) {
  const [folderName, setFolderName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!folderName.trim()) {
      setError("Folder name is required");
      return;
    }

    try {
      await onExport(folderName);
      setFolderName("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Export Page</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Save this UI as a page to the outputs folder. Both the TSX component and JSON tree will be saved.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Folder Name</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="my-page"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <p className="text-xs text-muted-foreground mt-1">
              Will be saved to: outputs/{folderName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "..."}/
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExporting || !folderName.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ FILE BROWSER SIDEBAR ============
interface FileBrowserProps {
  files: FileSystemNode[];
  isLoading: boolean;
  onRefresh: () => void;
}

function FileBrowser({ files, isLoading, onRefresh }: FileBrowserProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: FileSystemNode, depth = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isFolder = node.type === "folder";

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-1.5 py-1 px-2 cursor-pointer rounded hover:bg-muted/50 text-sm"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => isFolder && toggleExpand(node.path)}
        >
          {isFolder && (
            <span className="text-muted-foreground">
              <ChevronIcon expanded={isExpanded} />
            </span>
          )}
          {!isFolder && <span className="w-3" />}

          <span className={isFolder ? "text-yellow-500" : ""}>
            {isFolder ? <FolderIcon open={isExpanded} /> : <FileIcon type={node.isPage ? "page" : node.isJson ? "json" : "default"} />}
          </span>

          <span className={cn("truncate", node.isPage && "font-medium text-blue-400")}>
            {node.name}
          </span>
        </div>

        {isFolder && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border-t border-border/50 mt-4 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Exported Pages
        </h3>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <svg className={cn("size-3.5", isLoading && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {files.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 py-2">
          No pages exported yet
        </p>
      ) : (
        <div className="space-y-0.5">
          {files.map((node) => renderNode(node))}
        </div>
      )}
    </div>
  );
}

// ============ MAIN PAGE ============
export default function TryJsonRenderPage() {
  const [prompt, setPrompt] = useState("");
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportedFiles, setExportedFiles] = useState<FileSystemNode[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const { tree, isStreaming, error, send, clear } = useUIStream({
    api: "/api/json-render",
    onError: (err) => console.error("useUIStream error:", err),
    onComplete: (t) => console.log("useUIStream complete:", t),
  });

  const isLoading = isStreaming;

  // Load exported files on mount
  const loadExportedFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const files = await readOutputsDirectory();
      setExportedFiles(files);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    loadExportedFiles();
  }, [loadExportedFiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;
    await send(prompt);
  };

  const handleExampleClick = async (example: string) => {
    setPrompt(example);
    await send(example);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleExport = async (folderName: string) => {
    if (!tree) return;
    setIsExporting(true);
    try {
      const result = await exportTreeToFolder(tree, folderName);
      if (!result.success) {
        throw new Error(result.message);
      }
      await loadExportedFiles();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left side - Prompt input */}
      <div className="relative flex w-1/2 flex-col border-r border-border/50">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent" />

        {/* Header */}
        <header className="relative z-10 flex items-center gap-3 px-6 py-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-primary shadow-sm">
            <svg className="size-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-medium tracking-tight">JSON Render Playground</h1>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Generating UI..." : "Describe your UI"}
            </p>
          </div>
        </header>

        {/* Main content */}
        <div className="relative z-10 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Prompt input */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm transition-shadow focus-within:border-primary/30 focus-within:shadow-md focus-within:shadow-primary/5">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the UI you want to create..."
                  disabled={isLoading}
                  className="min-h-[100px] resize-none border-0 bg-transparent px-4 py-3.5 text-sm focus-visible:ring-0 disabled:opacity-50"
                  rows={4}
                />
                <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground/60">Press Enter to generate</p>
                  <div className="flex gap-2">
                    {tree && (
                      <button
                        type="button"
                        onClick={clear}
                        className="flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={isLoading || !prompt.trim()}
                      className={cn(
                        "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                        prompt.trim() && !isLoading
                          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      {isLoading ? (
                        <>
                          <svg className="size-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Generating...
                        </>
                      ) : (
                        <>Generate</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Example prompts */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try an example</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    disabled={isLoading}
                    className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Debug: Show raw tree */}
            {tree && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated JSON</p>
                <pre className="overflow-auto rounded-lg bg-muted/50 p-3 text-[10px] text-muted-foreground">
                  {JSON.stringify(tree, null, 2)}
                </pre>
              </div>
            )}

            {/* File Browser */}
            <FileBrowser
              files={exportedFiles}
              isLoading={isLoadingFiles}
              onRefresh={loadExportedFiles}
            />
          </div>
        </div>
      </div>

      {/* Right side - Rendered output */}
      <div className="flex w-1/2 flex-col bg-muted/20">
        <header className="flex items-center gap-2 border-b border-border/50 px-6 py-4">
          <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h2 className="text-sm font-medium tracking-tight">Preview</h2>
          <div className="ml-auto flex items-center gap-2">
            {isLoading && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                Streaming...
              </span>
            )}
            {tree && !isLoading && (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all duration-200 hover:bg-primary/90"
              >
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            )}
          </div>
        </header>

        <ScrollArea className="flex-1 p-6">
          {tree ? (
            <DataProvider>
              <VisibilityProvider>
                <ActionProvider>
                  <div className="space-y-4">
                    <Renderer tree={tree} registry={registry} loading={isLoading} />
                  </div>
                </ActionProvider>
              </VisibilityProvider>
            </DataProvider>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-muted/50">
                <svg className="size-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No preview yet</p>
              <p className="mt-1 max-w-[200px] text-xs text-muted-foreground/60">
                Enter a prompt to generate UI components
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        isExporting={isExporting}
      />
    </div>
  );
}
