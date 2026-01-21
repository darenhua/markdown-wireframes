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
import { ChatSidebar } from "./ChatSidebar";
import type { UITree } from "@json-render/core";
import { Renderer, DataProvider, VisibilityProvider, ActionProvider } from "@json-render/react";
import { registry } from "../try-jsonrender/registry";
import { saveTreeJson } from "./actions";
import { cn } from "@/lib/utils";

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
      className="pointer-events-none fixed z-9998 border-2 border-blue-500 bg-blue-500/10 transition-all duration-75"
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

// ============ SELECTED COMPONENT HIGHLIGHT ============
function SelectedComponentHighlight() {
  const { selectedComponent } = useInspector();
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Update rect position on scroll/resize
  useEffect(() => {
    if (!selectedComponent) {
      setRect(null);
      return;
    }

    // Initial rect from selection
    setRect(selectedComponent.rect);

    // Find the actual element and track its position
    const updatePosition = () => {
      // Try to find the element by various selectors
      let element: Element | null = null;

      if (selectedComponent.id) {
        element = document.getElementById(selectedComponent.id);
      }

      if (!element && selectedComponent.textContent) {
        // Try to find by text content
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_ELEMENT,
          null
        );

        while (walker.nextNode()) {
          const node = walker.currentNode as HTMLElement;
          if (
            node.tagName === selectedComponent.tagName &&
            node.textContent?.trim() === selectedComponent.textContent
          ) {
            element = node;
            break;
          }
        }
      }

      if (element) {
        setRect(element.getBoundingClientRect());
      }
    };

    // Update on scroll and resize
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    // Also update periodically for dynamic content
    const interval = setInterval(updatePosition, 500);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      clearInterval(interval);
    };
  }, [selectedComponent]);

  if (!selectedComponent || !rect) return null;

  return (
    <div
      className="pointer-events-none fixed z-[9997] border-2 border-yellow-400 bg-yellow-400/15 rounded-sm transition-all duration-150"
      style={{
        top: rect.top - 2,
        left: rect.left - 2,
        width: rect.width + 4,
        height: rect.height + 4,
        boxShadow: "0 0 0 1px rgba(250, 204, 21, 0.3), 0 0 8px rgba(250, 204, 21, 0.2)",
      }}
    />
  );
}

// ============ FLOATING PANEL TYPES ============
type ActivePanel = "pointer" | "notes";

const panelNames: Record<ActivePanel, string> = {
  pointer: "Select",
  notes: "Notes",
};

type GenerationMode = "standard" | "ensemble";
type PreviewSource = "merged" | "A" | "B" | "C";

type EnsembleMetadata = {
  evaluatorVariant: string;
  timing: {
    generatorsMs: number;
    evaluatorMs: number;
    totalMs: number;
  };
  generators: {
    A: { model: string; outputLength: number; usage: unknown };
    B: { model: string; outputLength: number; usage: unknown };
    C: { model: string; outputLength: number; usage: unknown };
  };
  evaluator: {
    model: string;
    usage: unknown;
  };
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

  // Chat/Ensemble state from sidebar (using compatible type)
  type LocalUITree = {
    root: string | null;
    elements: Record<string, unknown>;
  };
  
  const [chatTree, setChatTree] = useState<LocalUITree | null>(null);
  const [ensembleTrees, setEnsembleTrees] = useState<{
    merged: LocalUITree;
    A: LocalUITree;
    B: LocalUITree;
    C: LocalUITree;
  }>({
    merged: { root: null, elements: {} },
    A: { root: null, elements: {} },
    B: { root: null, elements: {} },
    C: { root: null, elements: {} },
  });
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard");
  const [ensembleMetadata, setEnsembleMetadata] = useState<EnsembleMetadata | null>(null);
  // Separate state for grid visibility - allows hiding grid on Enter while keeping ensemble mode selected
  const [showEnsembleGrid, setShowEnsembleGrid] = useState(false);
  
  // Initialize preview source from URL or default
  const [previewSource, setPreviewSource] = useState<PreviewSource>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get("preview") as PreviewSource | null;
      if (preview && ["merged", "A", "B", "C"].includes(preview)) {
        return preview;
      }
    }
    return "merged";
  });

  // Initialize current page from URL query params or localStorage
  const [currentPage, setCurrentPage] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get("page");
      if (pageParam) return pageParam;
      return localStorage.getItem("specstack-current-page") || "";
    }
    return "";
  });

  const { isEnabled, toggle, enable, selectedComponent, selectComponent } = useInspector();

  // Get current page name
  const currentPageName = currentFolderRef.current || currentRoutePath.replace(/^\//, "") || routes[0]?.path.replace(/^\//, "") || "";

  // Update URL and localStorage when current page changes
  const updateCurrentPage = useCallback((pageName: string) => {
    setCurrentPage(pageName);
    currentFolderRef.current = pageName;
    
    if (typeof window !== "undefined") {
      // Update localStorage
      localStorage.setItem("specstack-current-page", pageName);
      
      // Update URL query param
      const url = new URL(window.location.href);
      url.searchParams.set("page", pageName);
      window.history.replaceState({}, "", url.toString());
      
      console.log(`📄 Current page set to: ${pageName}`);
    }
  }, []);

  // Update URL when preview source changes
  const updatePreviewSource = useCallback((source: PreviewSource) => {
    setPreviewSource(source);
    // Update URL query param
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("preview", source);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Manual save handler for ensemble mode (Enter key)
  const handleManualSave = useCallback(async () => {
    // Use currentPage state instead of ref
    const folderName = currentPage || currentFolderRef.current;
    if (!folderName) {
      console.warn("⚠️ No folder selected for save. Create a page first!");
      return;
    }

    let treeToSave: LocalUITree | null = null;

    if (generationMode === "ensemble") {
      treeToSave = ensembleTrees[previewSource];
      console.log(`💾 Saving ${previewSource} tree to outputs/${folderName}/`);
    } else if (chatTree) {
      treeToSave = chatTree;
      console.log(`💾 Saving tree to outputs/${folderName}/`);
    }

    if (treeToSave && treeToSave.root) {
      try {
        const result = await saveTreeJson(treeToSave as UITree, folderName);
        if (result.success) {
          console.log("✅ Saved tree.json:", result.message);
          // Reload the tree to reflect the saved version
          const loadedTree = await loadTreeJson(folderName);
          if (loadedTree) {
            setLoadedTreeJson(loadedTree);
            setChatTree(loadedTree as LocalUITree);

            // Hide ensemble grid but keep mode selected for next prompt
            if (showEnsembleGrid) {
              setShowEnsembleGrid(false);
              setEnsembleTrees({
                merged: { root: null, elements: {} },
                A: { root: null, elements: {} },
                B: { root: null, elements: {} },
                C: { root: null, elements: {} },
              });
              console.log("📄 Grid hidden, showing saved tree (ensemble mode still active for next prompt)");
            }
          }
        } else {
          console.error("❌ Failed to save tree.json:", result.message);
        }
      } catch (err) {
        console.error("❌ Error saving tree.json:", err);
      }
    }
  }, [chatTree, ensembleTrees, showEnsembleGrid, previewSource, currentPage]);

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

      // Enter key to save when ensemble grid is showing
      if (e.key === "Enter" && showEnsembleGrid) {
        e.preventDefault();
        handleManualSave();
        return;
      }

      if (e.key === "x" || e.key === "X") {
        setActivePanel("pointer");
        return;
      }

      if (e.key === "c" || e.key === "C") {
        toggle();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, enable, selectedComponent, activePanel, showEnsembleGrid, handleManualSave]);

  // Fetch routes on mount and load the current page's tree
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

          // Determine which page to load: query param > localStorage > first page
          let pageToLoad = currentPage;
          if (!pageToLoad && typeof window !== "undefined") {
            pageToLoad = localStorage.getItem("specstack-current-page") || "";
          }
          if (!pageToLoad) {
            pageToLoad = configs[0].path.replace(/^\//, "");
          }

          // Verify the page exists in configs
          const pageExists = configs.some(c => c.path.replace(/^\//, "") === pageToLoad);
          if (!pageExists) {
            pageToLoad = configs[0].path.replace(/^\//, "");
          }

          // Set as current page
          updateCurrentPage(pageToLoad);
          
          // Load the tree.json for this page
          try {
            const treeData = await loadTreeJson(pageToLoad);
            if (treeData && treeData.root) {
              setChatTree(treeData as LocalUITree);
              console.log(`📂 Loaded saved tree from outputs/${pageToLoad}/tree.json`);
            }
          } catch {
            console.log(`No saved tree found for ${pageToLoad}`);
          }
        }
      } catch (error) {
        console.error("Failed to load output routes:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    if (activePanel !== "notes") {
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

        // Update current page to the newly created page
        updateCurrentPage(result.folderName);
        setLoadedTreeJson(null);
        setChatTree(null);
        selectComponent(null);
        setShowNewPageModal(false);
        setNewPageName("");
      }
    } catch (err) {
      console.error("Error creating new page:", err);
    } finally {
      setIsCreatingPage(false);
    }
  }, [selectedComponent, selectComponent, updateCurrentPage]);

  return (
    <div className="relative h-screen p-4 pb-8">
      <div className="flex h-full w-full gap-4">
        <div className="h-full w-[42%] min-w-[320px] max-w-[460px] flex flex-col">
          {/* Mode indicator bar */}
          <div className="h-1 w-full rounded-t-lg overflow-hidden">
            <div
              className={cn(
                "h-full w-full transition-colors duration-200",
                activePanel === "pointer" ? "bg-primary" : "bg-amber-500"
              )}
            />
          </div>

          {/* Sidebar content - swaps between Chat and Notebook */}
          <div className="flex-1 min-h-0">
            {activePanel === "pointer" ? (
              <ChatSidebar
                initialTree={chatTree as UITree | null}
                onTreeUpdate={setChatTree}
                onEnsembleTreesUpdate={setEnsembleTrees}
                onGenerationModeChange={setGenerationMode}
                onEnsembleMetadataUpdate={setEnsembleMetadata}
                onEnsembleGenerationStart={() => setShowEnsembleGrid(true)}
              />
            ) : (
              <div className="h-full flex flex-col rounded-b-2xl border border-t-0 border-border/50 bg-background/80 shadow-xl shadow-black/5 overflow-hidden">
                {/* NotebookPanel takes full height */}
                <div className="flex-1 min-h-0">
                  <NotebookPanel
                    pageName={currentPageName}
                    elementKey={specElementKey}
                    tree={loadedTreeJson}
                    initialContext={specContext}
                    onContextUpdate={(content) => setSpecContext(content)}
                    onElementKeyChange={(key) => setSpecElementKey(key)}
                  />
                </div>

                {/* Inspector toggle at bottom */}
                <div className="shrink-0 px-4 py-3 border-t border-border/50 bg-muted/20">
                  <Button
                    onClick={toggle}
                    size="sm"
                    variant={isEnabled ? "default" : "outline"}
                    className="w-full gap-2 h-8 text-xs"
                  >
                    <Crosshair className="h-3.5 w-3.5" />
                    {isEnabled ? "Inspector ON" : "Inspector OFF"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">Press C to toggle</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="relative flex-1">
          {/* Fixed title and current page indicator */}
          <div className="fixed bottom-8 right-8 z-50">
            <div className="flex flex-col items-end gap-1">
              {currentPage && (
                <div className="text-xs text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                  📄 {currentPage}
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
                  SpecStack
                </span>
                <a
                  href="https://turing.leanmcp.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-white/70 hover:text-white underline drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                >
                  turing
                </a>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex h-full w-full items-center justify-center overflow-auto rounded-lg bg-muted-foreground">
            {isLoading ? (
              <div className="size-8 animate-spin rounded-full border-2 border-background/30 border-t-background" />
            ) : showEnsembleGrid && (ensembleTrees.merged.root || ensembleTrees.A.root || ensembleTrees.B.root || ensembleTrees.C.root) ? (
              // Multi-panel ensemble view - 2x2 grid
              <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-2 p-2">
                {(["merged", "A", "B", "C"] as const).map((source) => {
                  const tree = ensembleTrees[source];
                  const hasContent = tree.root !== null;
                  const isActive = previewSource === source;
                  const label = source === "merged"
                    ? "✨ Merged"
                    : ensembleMetadata?.generators[source]?.model?.split("-")[0] || source;

                  return (
                    <div
                      key={source}
                      className={cn(
                        "rounded-lg border-2 transition-all overflow-hidden flex flex-col cursor-pointer",
                        isActive
                          ? source === "merged"
                            ? "border-emerald-500 shadow-lg shadow-emerald-500/20"
                            : "border-primary shadow-lg shadow-primary/20"
                          : "border-border/50 opacity-70 hover:opacity-100"
                      )}
                      onClick={() => updatePreviewSource(source)}
                    >
                      <div className={cn(
                        "px-3 py-1.5 text-xs font-medium border-b flex items-center justify-between",
                        isActive
                          ? source === "merged"
                            ? "bg-emerald-500 text-white"
                            : "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-muted-foreground"
                      )}>
                        <span>{label}</span>
                        {isActive && (
                          <span className="text-[10px] opacity-70">Press Enter to save</span>
                        )}
                      </div>
                      <AutoInspector>
                        <ScrollArea className="flex-1 p-3">
                          {hasContent ? (
                            <MemoryRouter>
                              <DataProvider>
                                <VisibilityProvider>
                                  <ActionProvider>
                                    <div className="space-y-2 scale-90 origin-top-left">
                                      <Renderer tree={tree as UITree} registry={registry} />
                                    </div>
                                  </ActionProvider>
                                </VisibilityProvider>
                              </DataProvider>
                            </MemoryRouter>
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                              No content
                            </div>
                          )}
                        </ScrollArea>
                      </AutoInspector>
                    </div>
                  );
                })}
              </div>
            ) : chatTree && chatTree.root ? (
              // Single tree view from standard mode
              <AutoInspector>
                <ScrollArea className="h-full w-full p-6">
                  <MemoryRouter>
                    <DataProvider>
                      <VisibilityProvider>
                        <ActionProvider>
                          <div className="space-y-4">
                            <Renderer tree={chatTree as UITree} registry={registry} />
                          </div>
                        </ActionProvider>
                      </VisibilityProvider>
                    </DataProvider>
                  </MemoryRouter>
                </ScrollArea>
              </AutoInspector>
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

          {/* Highlight overlays */}
          <HighlightOverlay />
          <SelectedComponentHighlight />

          {/* Floating bar */}
          <div className="absolute -bottom-6 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm">
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
