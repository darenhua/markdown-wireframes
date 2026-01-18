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
  MousePointer2,
  NotebookPen,
  Crosshair,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { getOutputRouteConfigs } from "../router-from-output/action";
import {
  loadTreeJson,
  createNewPage,
  addLinkToElement,
} from "./actions";
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

// ============ FLOATING PANEL TYPES ============
type ActivePanel = "pointer" | "notes";

const panelNames: Record<ActivePanel, string> = {
  pointer: "Select",
  notes: "Notes",
};

// ============ MAIN PAGE COMPONENT ============
function FloatingBarWithRouter() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("pointer");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [router, setRouter] = useState<ReturnType<typeof createMemoryRouter> | null>(null);
  const [currentRoutePath, setCurrentRoutePath] = useState<string>("");
  const [loadedTreeJson, setLoadedTreeJson] = useState<UITree | null>(null);
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [isCreatingPage, setIsCreatingPage] = useState(false);
  const currentFolderRef = useRef<string>("");

  // Notebook spec state
  const [specElementKey, setSpecElementKey] = useState<string | null>(null);
  const [specContext, setSpecContext] = useState<string>("");
  const [showElementSwitchConfirm, setShowElementSwitchConfirm] = useState(false);
  const [pendingElementKey, setPendingElementKey] = useState<string | null>(null);

  const { isEnabled, toggle, enable, selectedComponent, selectComponent } = useInspector();

  // Get current page name
  const currentPageName = currentFolderRef.current || currentRoutePath.replace(/^\//, "") || routes[0]?.path.replace(/^\//, "") || "";

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
        toggle();
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

  // Load tree.json when notes is active
  useEffect(() => {
    if (activePanel !== "notes") {
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
        selectComponent(null);
        setShowNewPageModal(false);
        setNewPageName("");
      }
    } catch (err) {
      console.error("Error creating new page:", err);
    } finally {
      setIsCreatingPage(false);
    }
  }, [selectedComponent, selectComponent]);

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

      {/* Floating panel - Notes only */}
      {activePanel === "notes" && (
        <div className="fixed bottom-3 right-2 z-30 flex w-80 flex-col rounded-lg border bg-gray-100 shadow-lg">
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

          {/* Inspector toggle */}
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
