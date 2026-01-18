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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  RouteConfig,
  InspectedElement,
  InspectorContextType,
} from "../router-with-box-model/types";
import { getOutputRouteConfigs } from "../router-with-box-model/action";

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

// ============ MAIN PAGE COMPONENT ============
function FloatingBarWithRouter() {
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [router, setRouter] = useState<ReturnType<
    typeof createMemoryRouter
  > | null>(null);

  const { isEnabled, toggle, selectedComponent, selectComponent } =
    useInspector();

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

  return (
    <div className="relative h-screen p-4 pb-8">
      {/* Main content area - React Router Output */}
      <div className="flex h-full w-full items-center justify-center overflow-auto rounded-lg bg-muted-foreground">
        {isLoading ? (
          <span className="text-2xl font-medium text-background">
            Loading...
          </span>
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

        {/* Panel content */}
        {activePanel !== "pointer" && !selectedComponent && (
          <>
            <h3 className="font-semibold">{panelNames[activePanel]}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {panelDescriptions[activePanel]}
            </p>
          </>
        )}

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
