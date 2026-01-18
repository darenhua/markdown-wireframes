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
  Hammer,
  MousePointer2,
  NotebookPen,
  Crosshair,
  Send,
  Plus,
  X,
  Bot,
  User,
  Wrench,
  CheckCircle,
  Loader2,
  RefreshCw,
  FileText,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { getOutputRouteConfigs } from "../router-from-output/action";
import { useAgentStream, type ChatMessage, type ToolCall } from "./useAgentStream";
import {
  loadTreeJson,
  createNewPage,
  addLinkToElement,
} from "./actions";
import { cn } from "@/lib/utils";
import { EmptyPageState } from "./error";
import { NotebookPanel } from "./components/NotebookPanel";
import { createInitialContext, type SelectorInfo } from "./spec-actions";
import type { UITree } from "@json-render/core";

// ============ TYPES ============
interface SelectedComponent {
  id: string;
  tagName: string;
  className: string;
  textContent: string;
  rect: DOMRect;
}

type RouteConfig = {
  path: string;
  name?: string;
};

type InspectedElement = {
  id: string;
  tagName: string;
  className: string;
  rect: DOMRect;
  computedStyle: {
    margin: string;
    padding: string;
    border: string;
    width: string;
    height: string;
  };
};

type InspectorContextType = {
  isEnabled: boolean;
  toggle: () => void;
  hoveredElement: InspectedElement | null;
  setHoveredElement: (element: InspectedElement | null) => void;
};

interface ExtendedInspectorContextType extends InspectorContextType {
  selectedComponent: SelectedComponent | null;
  selectComponent: (component: SelectedComponent | null) => void;
  enable: () => void;
}

// ============ CONTEXTS ============
const InspectorContext = createContext<ExtendedInspectorContextType | null>(null);

function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx) throw new Error("useInspector must be used within InspectorProvider");
  return ctx;
}

// ============ PROVIDERS ============
function InspectorProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<InspectedElement | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<SelectedComponent | null>(null);

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

// ============ DYNAMIC IMPORTS ============
function createDynamicPage(folderName: string) {
  return dynamic(
    () =>
      import(`@outputs/${folderName}/page`).catch(() => ({
        default: () => <EmptyPageState folderName={folderName} />,
      })),
    {
      loading: () => (
        <div className="flex h-full items-center justify-center p-6">
          <div className="size-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
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

// ============ TOOL CALL DISPLAY ============
function ToolCallDisplay({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded p-1.5 bg-muted/30 text-[10px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <Wrench className="h-2.5 w-2.5 text-blue-500" />
        <span className="font-medium truncate">{tool.name}</span>
        {tool.result !== undefined ? (
          <CheckCircle className="h-2.5 w-2.5 text-green-500 ml-auto flex-shrink-0" />
        ) : (
          <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground ml-auto flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1">
          <div>
            <span className="text-muted-foreground">Input:</span>
            <pre className="mt-0.5 p-1 bg-background rounded text-[8px] overflow-x-auto">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.result && (
            <div>
              <span className="text-muted-foreground">Result:</span>
              <pre className="mt-0.5 p-1 bg-background rounded text-[8px] overflow-x-auto max-h-16 overflow-y-auto">
                {tool.result.slice(0, 200)}
                {tool.result.length > 200 ? "..." : ""}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ MESSAGE DISPLAY ============
function MessageDisplay({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <div className={cn("flex gap-1.5", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          isSystem && "bg-red-100"
        )}
      >
        {isUser ? (
          <User className="h-2.5 w-2.5" />
        ) : isSystem ? (
          <X className="h-2.5 w-2.5 text-red-500" />
        ) : (
          <Bot className="h-2.5 w-2.5" />
        )}
      </div>
      <div className={cn("flex-1 space-y-1", isUser ? "text-right" : "text-left")}>
        {message.content && (
          <div
            className={cn(
              "inline-block rounded-lg px-2 py-1 text-[11px] max-w-[90%]",
              isUser
                ? "bg-primary text-primary-foreground"
                : isSystem
                ? "bg-red-50 text-red-800 border border-red-200"
                : "bg-muted"
            )}
          >
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        )}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-1 max-w-[90%]">
            {message.toolCalls.map((tool, idx) => (
              <ToolCallDisplay key={idx} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ FLOATING PANEL TYPES ============
type ActivePanel = "pointer" | "notes" | "tools";

const panelNames: Record<ActivePanel, string> = {
  pointer: "Select",
  notes: "Notes",
  tools: "Tools",
};

// ============ MAIN PAGE COMPONENT ============
function FloatingBarWithRouter() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [router, setRouter] = useState<ReturnType<typeof createMemoryRouter> | null>(null);
  const [currentRoutePath, setCurrentRoutePath] = useState<string>("");
  const [loadedTreeJson, setLoadedTreeJson] = useState<UITree | null>(null);
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentFolderRef = useRef<string>("");

  // Notebook spec state
  const [specElementKey, setSpecElementKey] = useState<string | null>(null);
  const [specContext, setSpecContext] = useState<string>("");
  const [showElementSwitchConfirm, setShowElementSwitchConfirm] = useState(false);
  const [pendingElementKey, setPendingElementKey] = useState<string | null>(null);

  const { isEnabled, toggle, enable, selectedComponent, selectComponent } = useInspector();

  // Agent stream for tools panel
  const {
    messages,
    isStreaming,
    error: streamError,
    currentToolCalls,
    send,
    cancel,
    clear,
  } = useAgentStream({
    api: "/api/claude-agent",
    onError: (err) => console.error("Agent error:", err),
  });

  // Get current page name
  const currentPageName = currentFolderRef.current || currentRoutePath.replace(/^\//, "") || routes[0]?.path.replace(/^\//, "") || "";

  // Auto-scroll messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentToolCalls]);

  // Hotkey handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (selectedComponent) {
          setShowNewPageModal(true);
        }
        return;
      }

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "c" || e.key === "C") {
        if (activePanel === "tools") {
          setActivePanel("pointer");
          enable();
        } else {
          toggle();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, enable, selectedComponent, activePanel]);

  // Fetch routes on mount
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
              const FirstPage = createDynamicPage(configs[0].path.replace(/^\//, ""));
              return <FirstPage />;
            })(),
          };

          const allRoutes = configs[0].path === "/" ? routeObjects : [defaultRoute, ...routeObjects];

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

  // Subscribe to router location changes
  useEffect(() => {
    if (!router) return;
    setCurrentRoutePath(router.state.location.pathname);
    const unsubscribe = router.subscribe((state) => {
      setCurrentRoutePath(state.location.pathname);
    });
    return () => unsubscribe();
  }, [router]);

  // Load tree.json when tools or notes is active
  useEffect(() => {
    if (activePanel !== "tools" && activePanel !== "notes") {
      setLoadedTreeJson(null);
      return;
    }

    const folderName = currentRoutePath.replace(/^\//, "") || routes[0]?.path.replace(/^\//, "");
    if (!folderName) return;

    currentFolderRef.current = folderName;

    async function fetchTree() {
      try {
        const treeData = await loadTreeJson(folderName);
        setLoadedTreeJson(treeData);
      } catch {
        setLoadedTreeJson(null);
      }
    }

    fetchTree();
  }, [activePanel, currentRoutePath, routes]);

  // Handle chat submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    send(input, { pageName: currentPageName });
    setInput("");
  };

  // Quick actions
  const handleQuickAction = (action: string) => {
    if (isStreaming) return;
    let prompt = "";
    switch (action) {
      case "list":
        prompt = "List all files in this directory";
        break;
      case "tree":
        prompt = "Read the tree.json file and summarize the components";
        break;
      case "create":
        prompt = "Create a new context.md file in the components directory with a basic template";
        break;
      case "read":
        prompt = "Read all context.md files and summarize what specs exist";
        break;
    }
    if (prompt) {
      send(prompt, { pageName: currentPageName });
    }
  };

  // Find element key from tree
  const findElementKeyFromSelection = useCallback(
    (tree: UITree | null, selected: SelectedComponent | null): string | null => {
      if (!tree || !selected) return null;

      const { textContent, tagName } = selected;
      const tagLower = tagName.toLowerCase();
      const trimmedText = textContent?.trim() || "";

      for (const [key, element] of Object.entries(tree.elements)) {
        const props = element.props || {};
        if (props.label === trimmedText) return key;
        if (props.text === trimmedText) return key;
        if (props.title === trimmedText) return key;
      }

      for (const [key, element] of Object.entries(tree.elements)) {
        const typeLower = element.type.toLowerCase();
        if (tagLower === "button" && typeLower === "button") return key;
        if (tagLower.match(/^h[1-6]$/) && typeLower === "heading") return key;
      }

      if (tree.root && tree.elements[tree.root]) {
        return tree.root;
      }

      return null;
    },
    []
  );

  // Handle element selection for spec mode
  const handleSpecElementSelection = useCallback(
    (newElementKey: string | null) => {
      if (!newElementKey) return;
      if (specElementKey && specElementKey !== newElementKey) {
        setPendingElementKey(newElementKey);
        setShowElementSwitchConfirm(true);
      } else if (!specElementKey) {
        setSpecElementKey(newElementKey);
      }
    },
    [specElementKey]
  );

  const confirmElementSwitch = useCallback(() => {
    setSpecElementKey(pendingElementKey);
    setPendingElementKey(null);
    setShowElementSwitchConfirm(false);
  }, [pendingElementKey]);

  const cancelElementSwitch = useCallback(() => {
    setPendingElementKey(null);
    setShowElementSwitchConfirm(false);
  }, []);

  // Track context creation
  const contextCreatedForRef = useRef<string | null>(null);

  // When element is selected, create context and switch to notes
  useEffect(() => {
    if (!selectedComponent) {
      contextCreatedForRef.current = null;
      return;
    }

    const selectionKey = `${selectedComponent.tagName}-${selectedComponent.textContent?.slice(0, 30)}`;
    if (contextCreatedForRef.current === selectionKey) return;

    const folderName = currentFolderRef.current || currentRoutePath.replace(/^\//, "");
    if (!folderName) return;

    const selectors: SelectorInfo = {
      tagName: selectedComponent.tagName,
      className: selectedComponent.className,
      textContent: selectedComponent.textContent,
      id: selectedComponent.id || undefined,
    };

    let elementKey = selectedComponent.id || selectedComponent.textContent?.slice(0, 20) || "selected-element";
    if (loadedTreeJson) {
      const foundKey = findElementKeyFromSelection(loadedTreeJson, selectedComponent);
      if (foundKey) {
        elementKey = foundKey;
        selectors.elementKey = foundKey;
      }
    }

    contextCreatedForRef.current = selectionKey;

    createInitialContext(folderName, elementKey, selectors).then((result) => {
      if (result.success) {
        setSpecElementKey(elementKey);
        if (activePanel !== "notes") {
          setActivePanel("notes");
        }
      }
    });
  }, [selectedComponent, currentRoutePath, loadedTreeJson, findElementKeyFromSelection, activePanel]);

  // Trigger spec conversation when element selected + notes panel active
  useEffect(() => {
    if (activePanel !== "notes" || !selectedComponent || !loadedTreeJson) return;

    const elementKey = findElementKeyFromSelection(loadedTreeJson, selectedComponent);
    if (elementKey) {
      handleSpecElementSelection(elementKey);
    }
  }, [activePanel, selectedComponent, loadedTreeJson, findElementKeyFromSelection, handleSpecElementSelection]);

  // Clear spec element when switching away from notes panel
  useEffect(() => {
    if (activePanel !== "notes") {
      setSpecElementKey(null);
      setSpecContext("");
    }
  }, [activePanel]);

  // Create new page handler
  const handleCreateNewPage = useCallback(async (customName?: string) => {
    setIsCreatingPage(true);
    try {
      const currentFolderName = currentFolderRef.current;
      const result = await createNewPage(undefined, customName);

      if (result.success && result.folderName) {
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
          }
        }

        const configs = await getOutputRouteConfigs();
        setRoutes(configs);

        if (configs.length > 0) {
          const routeObjects = configs.map((config) => {
            const fName = config.path.replace(/^\//, "");
            const PageComponent = createDynamicPage(fName);
            return { path: config.path, element: <PageComponent /> };
          });

          const defaultRoute = {
            path: "/",
            element: (() => {
              const FirstPage = createDynamicPage(configs[0].path.replace(/^\//, ""));
              return <FirstPage />;
            })(),
          };

          const allRoutes = configs[0].path === "/" ? routeObjects : [defaultRoute, ...routeObjects];

          const newRouter = createMemoryRouter(allRoutes, {
            initialEntries: [`/${result.folderName}`],
            initialIndex: 0,
          });

          setRouter(newRouter);
        }

        currentFolderRef.current = result.folderName;
        setLoadedTreeJson(null);
        clear();
        selectComponent(null);
        setActivePanel("tools");
        setShowNewPageModal(false);
        setNewPageName("");
      }
    } catch (err) {
      console.error("Error creating new page:", err);
    } finally {
      setIsCreatingPage(false);
    }
  }, [selectedComponent, selectComponent, clear]);

  return (
    <div className="relative h-screen p-4 pb-8">
      {/* Fixed title */}
      <div className="fixed bottom-8 left-8 z-50">
        <span className="text-xl font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          SpecStack
        </span>
      </div>

      {/* Main content area */}
      <div className="flex h-full w-full items-center justify-center overflow-auto rounded-lg bg-muted-foreground">
        {isLoading ? (
          <div className="size-8 animate-spin rounded-full border-2 border-background/30 border-t-background" />
        ) : router ? (
          <AutoInspector>
            <ScrollArea className="h-full w-full p-6">
              <RouterProvider router={router} />
            </ScrollArea>
          </AutoInspector>
        ) : routes.length === 0 ? (
          <span className="text-2xl font-medium text-background">No output pages found</span>
        ) : (
          <span className="text-2xl font-medium text-background">{panelNames[activePanel]}</span>
        )}
      </div>

      {/* Highlight overlay */}
      <HighlightOverlay />

      {/* Floating panel */}
      {activePanel !== "pointer" && (
        <div className="fixed bottom-3 right-2 z-30 flex w-80 flex-col rounded-lg border bg-gray-100 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">outputs/{currentPageName}/</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px]">
                {isStreaming ? "Working..." : "Ready"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={clear} disabled={isStreaming} className="h-6 w-6 p-0">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {activePanel === "tools" ? (
            <div className="flex flex-col h-[340px]">
              {/* Messages area */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
                {messages.length === 0 && !isStreaming ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-4">
                    <Bot className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs font-medium mb-1">Agent Ready</p>
                    <p className="text-[10px] text-muted-foreground max-w-[200px]">
                      Ask Claude to read files, write specs, or help document your components.
                    </p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageDisplay key={message.id} message={message} />
                  ))
                )}

                {/* Current tool calls */}
                {isStreaming && currentToolCalls.length > 0 && (
                  <div className="flex gap-1.5">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-muted">
                      <Bot className="h-2.5 w-2.5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      {currentToolCalls.map((tool, idx) => (
                        <ToolCallDisplay key={idx} tool={tool} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading indicator */}
                {isStreaming && currentToolCalls.length === 0 && (
                  <div className="flex gap-1.5">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-muted">
                      <Bot className="h-2.5 w-2.5" />
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-[10px] text-muted-foreground">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="px-2 py-1.5 border-t flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-muted-foreground">Quick:</span>
                <button
                  onClick={() => handleQuickAction("list")}
                  disabled={isStreaming}
                  className="text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <FileText className="h-2.5 w-2.5 inline mr-0.5" />
                  List files
                </button>
                <button
                  onClick={() => handleQuickAction("tree")}
                  disabled={isStreaming}
                  className="text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Read tree
                </button>
                <button
                  onClick={() => handleQuickAction("create")}
                  disabled={isStreaming}
                  className="text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Create spec
                </button>
                <button
                  onClick={() => handleQuickAction("read")}
                  disabled={isStreaming}
                  className="text-[9px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Read specs
                </button>
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="p-2 border-t">
                <div className="flex gap-1.5">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Ask Claude to read or write files..."
                    disabled={isStreaming}
                    className="min-h-[36px] max-h-[60px] resize-none text-xs"
                    rows={1}
                  />
                  {isStreaming ? (
                    <Button size="sm" type="button" variant="outline" onClick={cancel} className="h-9 w-9 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button size="sm" type="submit" disabled={!input.trim()} className="h-9 w-9 p-0">
                      <Send className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </form>

              {/* Error display */}
              {streamError && (
                <div className="mx-2 mb-2 p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-800">
                  {streamError.message}
                </div>
              )}
            </div>
          ) : activePanel === "notes" ? (
            <div className="h-[340px]">
              <NotebookPanel
                pageName={currentPageName}
                elementKey={specElementKey}
                tree={loadedTreeJson}
                initialContext={specContext}
                onContextUpdate={(content) => setSpecContext(content)}
                onElementKeyChange={(key) => setSpecElementKey(key)}
              />
            </div>
          ) : null}

          {/* Inspector toggle (only in notes panel) */}
          {activePanel === "notes" && (
            <div className="px-3 py-2 border-t">
              <Button
                onClick={toggle}
                size="sm"
                variant={isEnabled ? "default" : "outline"}
                className="w-full gap-2 h-7 text-xs"
              >
                <Crosshair className="h-3 w-3" />
                {isEnabled ? "Inspector ON" : "Inspector OFF"}
              </Button>
              <p className="text-[9px] text-muted-foreground text-center mt-1">Press C to toggle</p>
            </div>
          )}
        </div>
      )}

      {/* Floating bar */}
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
      </div>

      {/* New Page Modal */}
      {showNewPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNewPageModal(false)} />
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
                <p className="text-sm font-medium text-blue-800 mb-1">Linking from selected element:</p>
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
                <label className="text-sm font-medium mb-1.5 block">Page Name (optional)</label>
                <Input
                  type="text"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="e.g., settings, dashboard"
                  className="w-full"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Leave empty for auto-generated name
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowNewPageModal(false)}>
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

      {/* Element Switch Confirmation */}
      {showElementSwitchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={cancelElementSwitch} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="font-semibold mb-2">Switch Element?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You have an active spec conversation for{" "}
              <span className="font-mono text-foreground">{specElementKey}</span>.
              Switch to the new element?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={cancelElementSwitch}>
                Cancel
              </Button>
              <Button onClick={confirmElementSwitch}>
                Switch
              </Button>
            </div>
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
