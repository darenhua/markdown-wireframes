"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import type { FileSystemNode, CreateItemFormData } from "./types";
import { readFileSystem, getAllPages, createItem } from "./action";

// ============ ICONS ============
function FolderIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      {open ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      )}
    </svg>
  );
}

function FileIcon({ type }: { type?: "page" | "component" | "context" | "default" }) {
  const colors = {
    page: "text-blue-400",
    component: "text-green-400",
    context: "text-yellow-400",
    default: "text-gray-400",
  };

  return (
    <svg
      className={`w-4 h-4 ${colors[type || "default"]}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ============ TREE NODE COMPONENT ============
interface TreeNodeProps {
  node: FileSystemNode;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  pagePaths: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}

function TreeNode({
  node,
  depth,
  expandedPaths,
  selectedPath,
  pagePaths,
  onToggle,
  onSelect,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isFolder = node.type === "folder";
  const isPage = node.isPage || pagePaths.has(node.path);

  const getFileType = (): "page" | "component" | "context" | "default" => {
    if (node.isPage) return "page";
    if (node.isComponent) return "component";
    if (node.isContext) return "context";
    return "default";
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 cursor-pointer rounded hover:bg-gray-800 ${
          isSelected ? "bg-gray-700" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            onToggle(node.path);
          }
          onSelect(node.path);
        }}
      >
        {isFolder && (
          <span className="text-gray-500">
            <ChevronIcon expanded={isExpanded} />
          </span>
        )}
        {!isFolder && <span className="w-3" />}

        <span className={isFolder ? "text-yellow-500" : ""}>
          {isFolder ? (
            <FolderIcon open={isExpanded} />
          ) : (
            <FileIcon type={getFileType()} />
          )}
        </span>

        <span
          className={`text-sm truncate ${
            isPage ? "font-bold text-blue-300" : "text-gray-300"
          } ${node.name.startsWith("(") ? "text-purple-300" : ""}`}
        >
          {node.name}
        </span>
      </div>

      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              pagePaths={pagePaths}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ CREATE FORM COMPONENT ============
interface CreateFormProps {
  selectedPath: string | null;
  onSubmit: (data: CreateItemFormData) => Promise<void>;
  isPending: boolean;
}

function CreateForm({ selectedPath, onSubmit, isPending }: CreateFormProps) {
  const [mode, setMode] = useState<"page" | "component" | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      if (mode) {
        await onSubmit({
          name,
          itemType: mode,
          parentPath: selectedPath || "",
        });
      }
      setName("");
      setMode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  };

  if (!mode) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500 mb-2">
          Create in: <span className="text-gray-400">{selectedPath || "/"}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("page")}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 text-blue-300 rounded hover:bg-blue-600/30 text-sm"
          >
            <FileIcon type="page" />
            Page
          </button>
          <button
            onClick={() => setMode("component")}
            className="flex items-center gap-2 px-3 py-2 bg-green-600/20 text-green-300 rounded hover:bg-green-600/30 text-sm"
          >
            <FileIcon type="component" />
            Component
          </button>
        </div>
      </div>
    );
  }

  const labels = {
    page: "Page Name",
    component: "Component Name",
  };

  const colors = {
    page: "bg-blue-600 hover:bg-blue-700",
    component: "bg-green-600 hover:bg-green-700",
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Create {mode}</span>
        <button
          type="button"
          onClick={() => {
            setMode(null);
            setName("");
            setError(null);
          }}
          className="text-gray-500 hover:text-gray-300 text-sm"
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        placeholder={labels[mode]}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:outline-none focus:border-gray-500"
        autoFocus
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className={`w-full px-3 py-2 text-white rounded text-sm ${colors[mode]} disabled:opacity-50`}
      >
        {isPending ? "Creating..." : `Create ${mode}`}
      </button>
    </form>
  );
}

// ============ SIDEBAR COMPONENT ============
interface SidebarProps {
  tree: FileSystemNode[];
  pagePaths: Set<string>;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
  onRefresh: () => void;
  onSubmit: (data: CreateItemFormData) => Promise<void>;
  isPending: boolean;
  isLoading: boolean;
}

function Sidebar({
  tree,
  pagePaths,
  selectedPath,
  expandedPaths,
  onToggle,
  onSelect,
  onRefresh,
  onSubmit,
  isPending,
  isLoading,
}: SidebarProps) {
  return (
    <div className="w-72 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">File System</h2>
          <p className="text-xs text-gray-500">Manage your project structure</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-auto p-2">
        {tree.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm">No files yet</p>
            <p className="text-xs mt-1">Create your first page or component below</p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              pagePaths={pagePaths}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-gray-700">
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <FileIcon type="page" />
            <span className="text-gray-400">page.tsx</span>
          </span>
          <span className="flex items-center gap-1">
            <FileIcon type="component" />
            <span className="text-gray-400">component.tsx</span>
          </span>
          <span className="flex items-center gap-1">
            <FileIcon type="context" />
            <span className="text-gray-400">context.md</span>
          </span>
        </div>
      </div>

      {/* Create Form */}
      <div className="p-4 border-t border-gray-700">
        <CreateForm
          selectedPath={selectedPath}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </div>
    </div>
  );
}

// ============ DETAIL PANEL COMPONENT ============
interface DetailPanelProps {
  selectedPath: string | null;
  tree: FileSystemNode[];
}

function findNode(tree: FileSystemNode[], path: string): FileSystemNode | null {
  for (const node of tree) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function DetailPanel({ selectedPath, tree }: DetailPanelProps) {
  const node = selectedPath ? findNode(tree, selectedPath) : null;

  if (!node) {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-4">📁</div>
          <p className="text-lg">Select a file or folder</p>
          <p className="text-sm mt-2">Click on an item in the tree to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-950 p-6 overflow-auto">
      <div className="max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {node.type === "folder" ? (
            <FolderIcon open />
          ) : (
            <FileIcon
              type={
                node.isPage
                  ? "page"
                  : node.isComponent
                  ? "component"
                  : node.isContext
                  ? "context"
                  : "default"
              }
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{node.name}</h1>
            <p className="text-sm text-gray-500">{node.path}</p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Details</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex">
              <dt className="w-24 text-gray-500">Type:</dt>
              <dd className="text-gray-300">
                {node.type === "folder"
                  ? "Folder"
                  : node.isPage
                  ? "Page Component"
                  : node.isComponent
                  ? "UI Component"
                  : node.isContext
                  ? "Context Document"
                  : "File"}
              </dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">Path:</dt>
              <dd className="text-gray-300 font-mono text-xs">{node.path}</dd>
            </div>
            {node.type === "folder" && node.children && (
              <div className="flex">
                <dt className="w-24 text-gray-500">Contents:</dt>
                <dd className="text-gray-300">
                  {node.children.filter((c) => c.type === "folder").length} folders,{" "}
                  {node.children.filter((c) => c.type === "file").length} files
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Children Preview for folders */}
        {node.type === "folder" && node.children && node.children.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Contents</h3>
            <div className="space-y-1">
              {node.children.map((child) => (
                <div
                  key={child.path}
                  className="flex items-center gap-2 text-sm text-gray-400 py-1"
                >
                  {child.type === "folder" ? (
                    <FolderIcon />
                  ) : (
                    <FileIcon
                      type={
                        child.isPage
                          ? "page"
                          : child.isComponent
                          ? "component"
                          : child.isContext
                          ? "context"
                          : "default"
                      }
                    />
                  )}
                  <span className={child.isPage ? "font-bold text-blue-300" : ""}>
                    {child.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File naming conventions */}
        <div className="mt-6 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Naming Conventions</h3>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• Page folders: <code className="text-blue-300">*-page/page.tsx</code></li>
            <li>• Component folders: <code className="text-green-300">(*-component)/component.tsx</code></li>
            <li>• Context files: <code className="text-yellow-300">context.md</code> alongside pages/components</li>
            <li>• Nested components go in <code className="text-purple-300">(components)</code> folders</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN PAGE COMPONENT ============
export default function BuildingRealFsPage() {
  const [tree, setTree] = useState<FileSystemNode[]>([]);
  const [pagePaths, setPagePaths] = useState<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Load file system
  const loadFileSystem = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fsTree, pages] = await Promise.all([readFileSystem(), getAllPages()]);
      setTree(fsTree);
      setPagePaths(new Set(pages));
    } catch (error) {
      console.error("Failed to load file system:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFileSystem();
  }, [loadFileSystem]);

  // Toggle folder expansion
  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Select a node
  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  // Create item
  const handleCreateItem = useCallback(
    async (data: CreateItemFormData) => {
      startTransition(async () => {
        const result = await createItem(data);
        if (result.success) {
          await loadFileSystem();
          if (data.parentPath) {
            setExpandedPaths((prev) => new Set([...prev, data.parentPath]));
          }
        } else {
          throw new Error(result.message);
        }
      });
    },
    [loadFileSystem]
  );

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar
        tree={tree}
        pagePaths={pagePaths}
        selectedPath={selectedPath}
        expandedPaths={expandedPaths}
        onToggle={handleToggle}
        onSelect={handleSelect}
        onRefresh={loadFileSystem}
        onSubmit={handleCreateItem}
        isPending={isPending}
        isLoading={isLoading}
      />
      <DetailPanel selectedPath={selectedPath} tree={tree} />
    </div>
  );
}
