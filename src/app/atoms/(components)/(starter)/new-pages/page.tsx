"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
  useRef,
} from "react";
import { createMemoryRouter, RouterProvider, MemoryRouter } from "react-router-dom";
import dynamic from "next/dynamic";
import {
  FolderOpen,
  Hammer,
  MousePointer2,
  NotebookPen,
  Sparkles,
  Crosshair,
  Send,
  Plus,
  X,
  ChevronRight,
  FileText,
  Link2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Renderer, DataProvider, VisibilityProvider, ActionProvider } from "@json-render/react";
import type { UITree } from "@json-render/core";
import type {
  RouteConfig,
  InspectedElement,
  InspectorContextType,
} from "../router-with-box-model/types";
import { getOutputRouteConfigs } from "../router-with-box-model/action";
import { registry } from "../followup-prompts/registry";
import { useFollowUpStream } from "../followup-prompts/useFollowUpStream";
import {
  loadTreeJson,
  saveTreeJson,
  createNewPage,
  addLinkToElement,
  readOutputsFileSystem,
  readLinksGraph,
  type OutputFileNode,
  type LinksGraph,
} from "./actions";
import { cn } from "@/lib/utils";
import { EmptyPageState } from "./error";

// ============ EXTENDED TYPES ============
interface SelectedComponent {
  id: string;
  tagName: string;
  className: string;
  textContent: string;
  rect: DOMRect;
}

interface ExtendedInspectorContextType extends InspectorContextType {
  selectedComponent: SelectedComponent | null;
  selectComponent: (component: SelectedComponent | null) => void;
  enable: () => void;
}

// ============ CONTEXTS ============
const InspectorContext = createContext<ExtendedInspectorContextType | null>(
  null
);

function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx)
    throw new Error("useInspector must be used within InspectorProvider");
  return ctx;
}

// ============ PROVIDERS ============
function InspectorProvider({ children }: { children: React.ReactNode }) {
  // Inspector is ON by default until user selects an element
  const [isEnabled, setIsEnabled] = useState(false);
  const [hoveredElement, setHoveredElement] =
    useState<InspectedElement | null>(null);
  const [selectedComponent, setSelectedComponent] =
    useState<SelectedComponent | null>(null);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      if (prev) setHoveredElement(null);
      return !prev;
    });
  }, []);

  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  const selectComponent = useCallback((component: SelectedComponent | null) => {
    setSelectedComponent(component);
    // Exit inspector mode when selecting
    if (component) {
      setIsEnabled(false);
      setHoveredElement(null);
    }
  }, []);

  return (
    <InspectorContext.Provider
      value={{
        isEnabled,
        toggle,
        enable,
        hoveredElement,
        setHoveredElement,
        selectedComponent,
        selectComponent,
      }}
    >
      {children}
    </InspectorContext.Provider>
  );
}

// ============ DYNAMIC IMPORTS FOR OUTPUT PAGES ============
function createDynamicPage(folderName: string) {
  return dynamic(
    () =>
      import(`@outputs/${folderName}/page`).catch(() => {
        // Return a component that renders the empty state
        return {
          default: () => <EmptyPageState folderName={folderName} />,
        };
      }),
    {
      loading: () => (
        <div className="flex h-full items-center justify-center p-6 text-gray-400">
          Loading {folderName}...
        </div>
      ),
    }
  );
}

// ============ AUTO INSPECTOR WRAPPER ============
function AutoInspector({ children }: { children: React.ReactNode }) {
  const { isEnabled, setHoveredElement, selectComponent } = useInspector();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const handleMouseOver = (e: MouseEvent) => {
      if (!isEnabled) return;
      const target = e.target as HTMLElement;
      if (!target || target === containerRef.current) return;

      const rect = target.getBoundingClientRect();
      const computed = window.getComputedStyle(target);

      setHoveredElement({
        id: target.id || "",
        tagName: target.tagName,
        className: target.className || "",
        rect,
        computedStyle: {
          margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
          padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
          border: `${computed.borderTopWidth} ${computed.borderTopStyle} ${computed.borderTopColor}`,
          width: computed.width,
          height: computed.height,
        },
      });
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!isEnabled) return;
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!containerRef.current?.contains(relatedTarget)) {
        setHoveredElement(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!isEnabled) return;
      const target = e.target as HTMLElement;
      if (!target || target === containerRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = target.getBoundingClientRect();
      selectComponent({
        id: target.id || "",
        tagName: target.tagName,
        className: target.className || "",
        textContent: target.textContent?.trim() || "",
        rect,
      });
    };

    const container = containerRef.current;
    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick, true);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick, true);
    };
  }, [isEnabled, setHoveredElement, selectComponent]);

  return (
    <div ref={containerRef} className={isEnabled ? "cursor-crosshair" : ""}>
      {children}
    </div>
  );
}

// ============ HIGHLIGHT OVERLAY ============
function HighlightOverlay() {
  const { hoveredElement, isEnabled } = useInspector();

  if (!isEnabled || !hoveredElement) return null;

  const { rect } = hoveredElement;

  return (
    <div
      className="pointer-events-none fixed z-[9998] border-2 border-blue-500 bg-blue-500/10 transition-all duration-75"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      <div className="absolute -top-6 left-0 whitespace-nowrap rounded bg-blue-600 px-2 py-0.5 font-mono text-xs text-white">
        {hoveredElement.tagName.toLowerCase()}
        {hoveredElement.id && `#${hoveredElement.id}`}
        {hoveredElement.className &&
          typeof hoveredElement.className === "string" &&
          `.${hoveredElement.className.split(" ")[0]}`}
      </div>
    </div>
  );
}

// ============ FILE TREE NODE COMPONENT ============
interface FileTreeNodeProps {
  node: OutputFileNode;
  depth: number;
  currentRoutePath: string;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
}

function FileTreeNode({
  node,
  depth,
  currentRoutePath,
  expandedFolders,
  onToggle,
  onNavigate,
}: FileTreeNodeProps) {
  const isExpanded = expandedFolders.has(node.path);
  const isFolder = node.type === "folder";
  const isCurrentPage = currentRoutePath === `/${node.path}`;

  const getFileIcon = () => {
    if (node.isPage) return <FileText className="h-3.5 w-3.5 text-blue-400" />;
    if (node.isTree) return <FileText className="h-3.5 w-3.5 text-yellow-400" />;
    if (node.isRegistry) return <FileText className="h-3.5 w-3.5 text-green-400" />;
    return <FileText className="h-3.5 w-3.5 text-gray-400" />;
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-1 cursor-pointer rounded text-xs transition-colors",
          "hover:bg-muted/50",
          isCurrentPage && isFolder && "bg-primary/10 text-primary font-medium"
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (isFolder) {
            onToggle(node.path);
            onNavigate(node.path);
          }
        }}
      >
        {isFolder && (
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        )}
        {!isFolder && <span className="w-3" />}

        {isFolder ? (
          <FolderOpen className={cn("h-3.5 w-3.5", isExpanded ? "text-yellow-500" : "text-yellow-600")} />
        ) : (
          getFileIcon()
        )}

        <span className="truncate">{node.name}</span>

        {/* Link indicators */}
        {isFolder && node.linksTo && node.linksTo.length > 0 && (
          <span className="ml-auto flex items-center gap-0.5 text-[9px] text-blue-400">
            <ArrowRight className="h-2.5 w-2.5" />
            {node.linksTo.length}
          </span>
        )}
        {isFolder && node.linkedFrom && node.linkedFrom.length > 0 && (
          <span className="flex items-center gap-0.5 text-[9px] text-green-400">
            <Link2 className="h-2.5 w-2.5" />
            {node.linkedFrom.length}
          </span>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              currentRoutePath={currentRoutePath}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ FLOATING PANEL TYPES ============
type ActivePanel = "pointer" | "ai" | "notes" | "tools" | "files";

const panelNames: Record<ActivePanel, string> = {
  pointer: "Select",
  ai: "AI Assist",
  notes: "Notes",
  tools: "Tools",
  files: "Files",
};

const panelDescriptions: Record<ActivePanel, string> = {
  pointer: "Click to select elements on the canvas",
  ai: "Get AI-powered suggestions and assistance",
  notes: "Write and organize your notes",
  tools: "Access build and development tools",
  files: "Browse and manage your project files",
};

// ============ INITIAL PROMPTS (for creating from scratch) ============
const EXAMPLE_PROMPTS = [
  "Create a welcome card with sparkles icon and get started button",
  "Build a metrics dashboard with revenue, users, and growth stats",
  "Design a contact form with name, email, and message fields",
  "Create a user profile card with avatar and bio section",
];

// ============ FOLLOWUP SUGGESTIONS ============
const FOLLOWUP_SUGGESTIONS = [
  "Add a heart icon next to the title",
  "Change the card to a warm gradient background",
  "Add a secondary button with outline variant",
  "Convert this to use tabs for different sections",
];

// ============ MAIN PAGE COMPONENT ============
function FloatingBarWithRouter() {
  // Start with pointer panel - inspector is ON by default until element selected
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [router, setRouter] = useState<ReturnType<
    typeof createMemoryRouter
  > | null>(null);

  // Track current route path
  const [currentRoutePath, setCurrentRoutePath] = useState<string>("");

  // Follow-up prompt state
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [persistedTree, setPersistedTree] = useState<UITree | null>(null);
  const [loadedTreeJson, setLoadedTreeJson] = useState<UITree | null>(null);

  // New page modal state
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  // File system state
  const [fileTree, setFileTree] = useState<OutputFileNode[]>([]);
  const [linksGraph, setLinksGraph] = useState<LinksGraph>({ nodes: [], edges: [] });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Ref to track current folder for saving on completion
  const currentFolderRef = useRef<string>("");

  // useFollowUpStream for AI modifications
  const { tree: streamingTree, isStreaming, error: streamError, send, clear } = useFollowUpStream({
    api: "/api/json-render",
    onError: (err) => console.error("useFollowUpStream error:", err),
    onComplete: async (completedTree) => {
      setPersistedTree(completedTree);

      // Auto-save tree.json to file system after streaming completes
      const folderName = currentFolderRef.current;
      if (folderName) {
        try {
          const result = await saveTreeJson(completedTree, folderName);
          if (result.success) {
            console.log("Auto-saved tree.json:", result.message);
          } else {
            console.error("Failed to auto-save tree.json:", result.message);
          }
        } catch (err) {
          console.error("Error auto-saving tree.json:", err);
        }
      }
    },
  });

  const { isEnabled, toggle, enable, selectedComponent, selectComponent } =
    useInspector();

  // Determine display tree (streaming tree takes precedence, then persisted, then loaded from file)
  const displayTree = streamingTree ?? persistedTree ?? loadedTreeJson;

  // Hotkey 'c' to toggle inspector or switch panels, Command+K to create new page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command+K to create new page (only when element is selected)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (selectedComponent) {
          // Open modal to create new page
          setShowNewPageModal(true);
        }
        return;
      }

      // Don't trigger hotkeys if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "c" || e.key === "C") {
        // In tools mode, switch to files panel and enable inspector
        if (activePanel === "tools") {
          setActivePanel("files");
          enable();
        } else {
          toggle();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, enable, selectedComponent, activePanel]);

  // Fetch routes from outputs folder on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const configs = await getOutputRouteConfigs();
        setRoutes(configs);

        if (configs.length > 0) {
          const routeObjects = configs.map((config) => {
            const folderName = config.path.replace(/^\//, "");
            const PageComponent = createDynamicPage(folderName);
            return {
              path: config.path,
              element: <PageComponent />,
            };
          });

          const defaultRoute = {
            path: "/",
            element: (() => {
              const FirstPage = createDynamicPage(
                configs[0].path.replace(/^\//, "")
              );
              return <FirstPage />;
            })(),
          };

          const allRoutes =
            configs[0].path === "/"
              ? routeObjects
              : [defaultRoute, ...routeObjects];

          const newRouter = createMemoryRouter(allRoutes, {
            initialEntries: [configs[0].path],
            initialIndex: 0,
          });

          setRouter(newRouter);
        }
      } catch (error) {
        console.error("Failed to load output routes:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadRoutes();
  }, []);

  // Subscribe to router location changes to track current route
  useEffect(() => {
    if (!router) return;

    // Set initial route path
    setCurrentRoutePath(router.state.location.pathname);

    // Subscribe to route changes
    const unsubscribe = router.subscribe((state) => {
      setCurrentRoutePath(state.location.pathname);
    });

    return () => unsubscribe();
  }, [router]);

  // Load tree.json when hammer/tools is active and route has one
  useEffect(() => {
    if (activePanel !== "tools") {
      // Reset loaded tree when switching away from tools
      setLoadedTreeJson(null);
      setPersistedTree(null);
      clear();
      return;
    }

    // Extract folder name from current route path
    const folderName = currentRoutePath.replace(/^\//, "") || routes[0]?.path.replace(/^\//, "");
    if (!folderName) return;

    // Store folder name in ref for auto-save on completion
    currentFolderRef.current = folderName;

    // Load tree.json for this route via server action
    async function fetchTree() {
      try {
        const treeData = await loadTreeJson(folderName);
        setLoadedTreeJson(treeData);
      } catch {
        setLoadedTreeJson(null);
      }
    }

    fetchTree();
  }, [activePanel, currentRoutePath, routes, clear]);

  // Follow-up prompt handlers
  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpPrompt.trim() || isStreaming) return;

    const currentTree = persistedTree ?? loadedTreeJson;
    if (currentTree) {
      await send(followUpPrompt, { currentTree });
    } else {
      await send(followUpPrompt);
    }
    setFollowUpPrompt("");
  };

  const handleFollowUpClick = async (suggestion: string) => {
    const currentTree = persistedTree ?? loadedTreeJson;
    if (currentTree) {
      await send(suggestion, { currentTree });
    } else {
      await send(suggestion);
    }
  };

  // Handler for initial prompts (creating from scratch, no existing tree)
  const handleExampleClick = async (example: string) => {
    setFollowUpPrompt("");
    await send(example);
  };

  const handleFollowUpKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFollowUpSubmit(e as unknown as React.FormEvent);
    }
  };

  // Load file system for the files panel
  const loadFileSystem = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const [tree, graph] = await Promise.all([
        readOutputsFileSystem(),
        readLinksGraph(),
      ]);
      setFileTree(tree);
      setLinksGraph(graph);
    } catch (err) {
      console.error("Failed to load file system:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Load file system on mount
  useEffect(() => {
    loadFileSystem();
  }, [loadFileSystem]);

  // Reload when files panel is selected
  useEffect(() => {
    if (activePanel === "files") {
      loadFileSystem();
    }
  }, [activePanel, loadFileSystem]);

  // Create new page handler - creates a new page and links the selected element to it
  const handleCreateNewPage = useCallback(async (customName?: string) => {
    setIsCreatingPage(true);
    try {
      const currentFolderName = currentFolderRef.current;

      // First save current tree if we have one
      const currentTree = persistedTree ?? loadedTreeJson;
      if (currentTree && currentFolderName) {
        await saveTreeJson(currentTree, currentFolderName);
        console.log("Saved current tree before creating new page");
      }

      // Create the new page
      const result = await createNewPage(undefined, customName);

      if (result.success && result.folderName) {
        console.log("Created new page:", result.folderName);

        // If we have a selected component, link it to the new page
        if (selectedComponent && currentFolderName) {
          const linkResult = await addLinkToElement(
            currentFolderName,
            {
              id: selectedComponent.id,
              tagName: selectedComponent.tagName,
              className: selectedComponent.className,
              textContent: selectedComponent.textContent,
            },
            `/${result.folderName}`
          );

          if (linkResult.success) {
            console.log("Added link to element:", linkResult.message);
            // Update persisted tree with the linked version
            if (linkResult.tree) {
              setPersistedTree(linkResult.tree);
            }
          } else {
            console.warn("Could not add link to element:", linkResult.message);
          }
        }

        // Refresh routes to include new page
        const configs = await getOutputRouteConfigs();
        setRoutes(configs);

        // Create new router with the new page as initial route
        if (configs.length > 0) {
          const routeObjects = configs.map((config) => {
            const fName = config.path.replace(/^\//, "");
            const PageComponent = createDynamicPage(fName);
            return {
              path: config.path,
              element: <PageComponent />,
            };
          });

          const defaultRoute = {
            path: "/",
            element: (() => {
              const FirstPage = createDynamicPage(configs[0].path.replace(/^\//, ""));
              return <FirstPage />;
            })(),
          };

          const allRoutes =
            configs[0].path === "/" ? routeObjects : [defaultRoute, ...routeObjects];

          // Create router starting at the new page
          const newRouter = createMemoryRouter(allRoutes, {
            initialEntries: [`/${result.folderName}`],
            initialIndex: 0,
          });

          setRouter(newRouter);
        }

        // Update current folder ref to the new page
        currentFolderRef.current = result.folderName;

        // Clear existing tree state so new page's tree.json gets loaded
        setPersistedTree(null);
        setLoadedTreeJson(null);
        clear(); // Clear any streaming state

        // Clear selected component since we've linked it
        selectComponent(null);

        // Reload file system
        await loadFileSystem();

        // Load the new page's tree.json (will be the default placeholder)
        try {
          const newTree = await loadTreeJson(result.folderName);
          setLoadedTreeJson(newTree);
        } catch {
          // New page will have default tree, that's fine
        }

        // Switch to tools/hammer panel AFTER all state is ready
        setActivePanel("tools");

        // Close modal
        setShowNewPageModal(false);
        setNewPageName("");
      } else {
        console.error("Failed to create new page:", result.message);
      }
    } catch (err) {
      console.error("Error creating new page:", err);
    } finally {
      setIsCreatingPage(false);
    }
  }, [persistedTree, loadedTreeJson, loadFileSystem, selectedComponent, selectComponent, clear]);

  // Determine if we're in follow-up mode (have a tree to modify)
  const isFollowUpMode = displayTree !== null;

  return (
    <div className="relative h-screen p-4 pb-8">
      {/* Main content area - conditionally shows json-render or Router */}
      <div className="flex h-full w-full items-center justify-center overflow-auto rounded-lg bg-muted-foreground">
        {isLoading ? (
          <span className="text-2xl font-medium text-background">
            Loading...
          </span>
        ) : activePanel === "tools" ? (
          // When hammer/tools is active, show json-render UI
          <div className="h-full w-full overflow-auto p-6">
            {displayTree ? (
              <MemoryRouter>
                <DataProvider>
                  <VisibilityProvider>
                    <ActionProvider>
                      <div className="space-y-4">
                        <Renderer tree={displayTree} registry={registry} loading={isStreaming} />
                      </div>
                    </ActionProvider>
                  </VisibilityProvider>
                </DataProvider>
              </MemoryRouter>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-background/10">
                  <Sparkles className="size-8 text-background/60" />
                </div>
                <p className="text-lg font-medium text-background">Create your first UI</p>
                <p className="mt-2 max-w-[280px] text-sm text-background/70">
                  Use the prompt input in the sidebar to describe the UI you want to generate
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-background/50">
                  <ArrowRight className="size-3" />
                  <span>Try an example prompt to get started</span>
                </div>
              </div>
            )}
          </div>
        ) : router ? (
          <AutoInspector>
            <ScrollArea className="h-full w-full p-6">
              <RouterProvider router={router} />
            </ScrollArea>
          </AutoInspector>
        ) : routes.length === 0 ? (
          <span className="text-2xl font-medium text-background">
            No output pages found
          </span>
        ) : (
          <span className="text-2xl font-medium text-background">
            {panelNames[activePanel]}
          </span>
        )}
      </div>

      {/* Highlight overlay for inspector */}
      <HighlightOverlay />

      {/* Floating panel bottom right - hidden in pointer mode */}
      {activePanel !== "pointer" && (
        <div className="fixed bottom-3 right-2 z-30 flex w-72 flex-col rounded-lg border bg-gray-100 p-4 shadow-lg">
          {/* Inspector toggle button - hidden in tools mode */}
          {activePanel !== "tools" && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Button
                  onClick={toggle}
                  size="sm"
                  variant={isEnabled ? "default" : "outline"}
                  className="flex-1 gap-2"
                >
                  <Crosshair className="h-4 w-4" />
                  {isEnabled ? "Inspector ON" : "Inspector OFF"}
                </Button>
                <span className="text-xs text-muted-foreground">Press C</span>
              </div>

              {/* Selected component display */}
              {selectedComponent && (
                <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="default" className="bg-blue-600">
                      Working on this component
                    </Badge>
                    <button
                      onClick={() => selectComponent(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div>
                      <span className="text-gray-500">Tag: </span>
                      <span className="text-blue-700">
                        {selectedComponent.tagName.toLowerCase()}
                      </span>
                    </div>
                    {selectedComponent.id && (
                      <div>
                        <span className="text-gray-500">ID: </span>
                        <span className="text-purple-700">
                          #{selectedComponent.id}
                        </span>
                      </div>
                    )}
                    {selectedComponent.className && (
                      <div>
                        <span className="text-gray-500">Class: </span>
                        <span className="text-orange-700 break-all">
                          .
                          {typeof selectedComponent.className === "string"
                            ? selectedComponent.className.split(" ").slice(0, 2).join(" .")
                            : ""}
                        </span>
                      </div>
                    )}
                    <div className="pt-1 text-gray-400">
                      {Math.round(selectedComponent.rect.width)}×
                      {Math.round(selectedComponent.rect.height)}px
                    </div>
                  </div>
                  {/* Cmd+K hint */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                    <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px]">
                      ⌘K
                    </kbd>
                    <span>Create new page from this element</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Panel content - show prompt input when tools/hammer is active */}
          {activePanel === "tools" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {isFollowUpMode ? "Modify UI" : "Create UI"}
                </h3>
                {isStreaming && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                    {isFollowUpMode ? "Modifying..." : "Generating..."}
                  </span>
                )}
              </div>

              {/* Prompt input */}
              <form onSubmit={handleFollowUpSubmit} className="space-y-2">
                <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm focus-within:border-primary/30">
                  <Textarea
                    value={followUpPrompt}
                    onChange={(e) => setFollowUpPrompt(e.target.value)}
                    onKeyDown={handleFollowUpKeyDown}
                    placeholder={
                      isFollowUpMode
                        ? "Describe how to modify the UI..."
                        : "Describe the UI you want to create..."
                    }
                    disabled={isStreaming}
                    className="min-h-[60px] resize-none border-0 bg-transparent px-3 py-2 text-xs focus-visible:ring-0 disabled:opacity-50"
                    rows={2}
                  />
                  <div className="flex items-center justify-end border-t border-border/40 bg-muted/20 px-2 py-1.5">
                    <button
                      type="submit"
                      disabled={isStreaming || !followUpPrompt.trim()}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
                        followUpPrompt.trim() && !isStreaming
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      <Send className="size-3" />
                      {isFollowUpMode ? "Modify" : "Generate"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Suggestions - different for initial vs follow-up mode */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {isFollowUpMode ? "Suggestions" : "Try an example"}
                </p>
                <div className="flex flex-wrap gap-1">
                  {isFollowUpMode ? (
                    FOLLOWUP_SUGGESTIONS.slice(0, 3).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleFollowUpClick(suggestion)}
                        disabled={isStreaming}
                        className="rounded border border-primary/30 bg-primary/5 px-2 py-1 text-left text-[10px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))
                  ) : (
                    EXAMPLE_PROMPTS.slice(0, 3).map((example, index) => (
                      <button
                        key={index}
                        onClick={() => handleExampleClick(example)}
                        disabled={isStreaming}
                        className="rounded border border-border/60 bg-background px-2 py-1 text-left text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                      >
                        {example}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Error display */}
              {streamError && (
                <div className="rounded bg-destructive/10 p-2 text-[10px] text-destructive">
                  Error: {streamError.message}
                </div>
              )}
            </div>
          ) : activePanel === "files" ? (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Pages</h3>
                <button
                  onClick={loadFileSystem}
                  disabled={isLoadingFiles}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoadingFiles && "animate-spin")} />
                </button>
              </div>

              {/* File Tree */}
              <ScrollArea className="h-[200px] -mx-2 px-2">
                {fileTree.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No pages yet</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Create your first page below
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {fileTree.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        currentRoutePath={currentRoutePath}
                        expandedFolders={expandedFolders}
                        onToggle={toggleFolder}
                        onNavigate={(path) => {
                          if (router) {
                            router.navigate(`/${path}`);
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Links Graph Summary */}
              {linksGraph.edges.length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    Page Links
                  </p>
                  <div className="space-y-1 text-[10px]">
                    {linksGraph.edges.slice(0, 3).map((edge, i) => (
                      <div key={i} className="flex items-center gap-1 text-muted-foreground">
                        <span className="truncate">{edge.from}</span>
                        <ArrowRight className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{edge.to}</span>
                      </div>
                    ))}
                    {linksGraph.edges.length > 3 && (
                      <p className="text-muted-foreground/60">
                        +{linksGraph.edges.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* New Page Button */}
              <div className="pt-2 border-t border-border/50">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewPageModal(true)}
                  className="w-full gap-1"
                >
                  <Plus className="h-3 w-3" />
                  New Page
                </Button>
              </div>

              {/* Legend */}
              <div className="pt-2 border-t border-border/50">
                <div className="flex flex-wrap gap-2 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ArrowRight className="h-2.5 w-2.5 text-blue-400" />
                    links to
                  </span>
                  <span className="flex items-center gap-1">
                    <Link2 className="h-2.5 w-2.5 text-green-400" />
                    linked from
                  </span>
                </div>
              </div>
            </div>
          ) : activePanel !== "pointer" && !selectedComponent ? (
            <>
              <h3 className="font-semibold">{panelNames[activePanel]}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {panelDescriptions[activePanel]}
              </p>
            </>
          ) : null}

          {/* Inspector hint when active */}
          {isEnabled && (
            <div className="mt-2 rounded bg-blue-100 p-2 text-xs text-blue-700">
              Click on any element to select it
            </div>
          )}
        </div>
      )}

      {/* Floating bar at bottom */}
      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm">
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("pointer")}
          size="icon"
          variant={activePanel === "pointer" ? "default" : "ghost"}
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("ai")}
          size="icon"
          variant={activePanel === "ai" ? "default" : "ghost"}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("notes")}
          size="icon"
          variant={activePanel === "notes" ? "default" : "ghost"}
        >
          <NotebookPen className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("tools")}
          size="icon"
          variant={activePanel === "tools" ? "default" : "ghost"}
        >
          <Hammer className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("files")}
          size="icon"
          variant={activePanel === "files" ? "default" : "ghost"}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>

      {/* New Page Modal */}
      {showNewPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowNewPageModal(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Page</h2>
              <button
                onClick={() => setShowNewPageModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedComponent && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-800 mb-1">
                  Linking from selected element:
                </p>
                <p className="font-mono text-xs text-blue-700">
                  {selectedComponent.tagName.toLowerCase()}
                  {selectedComponent.textContent && (
                    <span className="text-blue-600">
                      {" → "}&quot;{selectedComponent.textContent.slice(0, 30)}
                      {selectedComponent.textContent.length > 30 ? "..." : ""}&quot;
                    </span>
                  )}
                </p>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateNewPage(newPageName || undefined);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Page Name (optional)
                </label>
                <Input
                  type="text"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="e.g., settings, dashboard"
                  className="w-full"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Leave empty for auto-generated name (page-1, page-2, etc.)
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewPageModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreatingPage}>
                  {isCreatingPage ? (
                    <>
                      <span className="mr-2 size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" />
                      Create Page
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ EXPORTED PAGE COMPONENT ============
export default function FloatingBarPage() {
  return (
    <InspectorProvider>
      <FloatingBarWithRouter />
    </InspectorProvider>
  );
}
