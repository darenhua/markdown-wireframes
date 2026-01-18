"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
  useRef,
} from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import dynamic from "next/dynamic";
import {
  FolderOpen,
  Hammer,
  MousePointer2,
  NotebookPen,
  Sparkles,
  Crosshair,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { loadTreeJson, saveTreeJson } from "./actions";
import { cn } from "@/lib/utils";

// ============ EXTENDED TYPES ============
interface SelectedComponent {
  id: string;
  tagName: string;
  className: string;
  rect: DOMRect;
}

interface ExtendedInspectorContextType extends InspectorContextType {
  selectedComponent: SelectedComponent | null;
  selectComponent: (component: SelectedComponent | null) => void;
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
  return dynamic(() => import(`@outputs/${folderName}/page`), {
    loading: () => (
      <div className="flex h-full items-center justify-center p-6 text-gray-400">
        Loading {folderName}...
      </div>
    ),
  });
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

// ============ FOLLOWUP SUGGESTIONS ============
const FOLLOWUP_SUGGESTIONS = [
  "Add a heart icon next to the title",
  "Change the card to a warm gradient background",
  "Add a secondary button with outline variant",
  "Convert this to use tabs for different sections",
];

// ============ MAIN PAGE COMPONENT ============
function FloatingBarWithRouter() {
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

  const { isEnabled, toggle, selectedComponent, selectComponent } =
    useInspector();

  // Determine display tree (streaming tree takes precedence, then persisted, then loaded from file)
  const displayTree = streamingTree ?? persistedTree ?? loadedTreeJson;

  // Hotkey 'c' to toggle inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "c" || e.key === "C") {
        toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

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

  const handleFollowUpKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFollowUpSubmit(e as unknown as React.FormEvent);
    }
  };

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
          <ScrollArea className="h-full w-full p-6">
            {displayTree ? (
              <DataProvider>
                <VisibilityProvider>
                  <ActionProvider>
                    <div className="space-y-4">
                      <Renderer tree={displayTree} registry={registry} loading={isStreaming} />
                    </div>
                  </ActionProvider>
                </VisibilityProvider>
              </DataProvider>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-background/20">
                  <Hammer className="size-6 text-background/50" />
                </div>
                <p className="text-sm text-background">No tree.json found for this route</p>
                <p className="mt-1 max-w-[250px] text-xs text-background/60">
                  Routes with a tree.json file will render here when the hammer tool is active
                </p>
              </div>
            )}
          </ScrollArea>
        ) : router ? (
          <AutoInspector>
            <div className="h-full w-full">
              <RouterProvider router={router} />
            </div>
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

      {/* Floating panel bottom right */}
      <div className="fixed bottom-3 right-2 z-30 flex w-72 flex-col rounded-lg border bg-gray-100 p-4 shadow-lg">
        {/* Inspector toggle button */}
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
          </div>
        )}

        {/* Panel content - show follow-up prompts when tools/hammer is active */}
        {activePanel === "tools" && isFollowUpMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Modify UI</h3>
              {isStreaming && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                  Modifying...
                </span>
              )}
            </div>

            {/* Follow-up prompt input */}
            <form onSubmit={handleFollowUpSubmit} className="space-y-2">
              <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm focus-within:border-primary/30">
                <Textarea
                  value={followUpPrompt}
                  onChange={(e) => setFollowUpPrompt(e.target.value)}
                  onKeyDown={handleFollowUpKeyDown}
                  placeholder="Describe how to modify the UI..."
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
                    Modify
                  </button>
                </div>
              </div>
            </form>

            {/* Follow-up suggestions */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Suggestions
              </p>
              <div className="flex flex-wrap gap-1">
                {FOLLOWUP_SUGGESTIONS.slice(0, 3).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleFollowUpClick(suggestion)}
                    disabled={isStreaming}
                    className="rounded border border-primary/30 bg-primary/5 px-2 py-1 text-left text-[10px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Error display */}
            {streamError && (
              <div className="rounded bg-destructive/10 p-2 text-[10px] text-destructive">
                Error: {streamError.message}
              </div>
            )}
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
