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
import type {
  RouteConfig,
  NavbarState,
  InspectedElement,
  InspectorContextType,
  ContextMenuState,
  SpecialComponentConfig,
} from "./types";
import { getOutputRouteConfigs } from "./action";
import specialComponentsConfig from "./special-components.json";

// ============ CONTEXTS ============
const InspectorContext = createContext<InspectorContextType | null>(null);

interface SpecialComponentContextType {
  config: SpecialComponentConfig;
  contextMenu: ContextMenuState;
  openContextMenu: (targetId: string) => void;
  closeContextMenu: () => void;
}

const SpecialComponentContext =
  createContext<SpecialComponentContextType | null>(null);

function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx)
    throw new Error("useInspector must be used within InspectorProvider");
  return ctx;
}

function useSpecialComponent() {
  const ctx = useContext(SpecialComponentContext);
  if (!ctx)
    throw new Error(
      "useSpecialComponent must be used within SpecialComponentProvider"
    );
  return ctx;
}

// ============ PROVIDERS ============
function InspectorProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [hoveredElement, setHoveredElement] =
    useState<InspectedElement | null>(null);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      if (prev) setHoveredElement(null);
      return !prev;
    });
  }, []);

  return (
    <InspectorContext.Provider
      value={{ isEnabled, toggle, hoveredElement, setHoveredElement }}
    >
      {children}
    </InspectorContext.Provider>
  );
}

function SpecialComponentProvider({ children }: { children: React.ReactNode }) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    targetId: null,
  });

  const config = specialComponentsConfig.components as SpecialComponentConfig;

  const openContextMenu = useCallback((targetId: string) => {
    setContextMenu({ isOpen: true, targetId });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ isOpen: false, targetId: null });
  }, []);

  return (
    <SpecialComponentContext.Provider
      value={{ config, contextMenu, openContextMenu, closeContextMenu }}
    >
      {children}
    </SpecialComponentContext.Provider>
  );
}

// ============ DYNAMIC IMPORTS FOR OUTPUT PAGES ============
function createDynamicPage(folderName: string) {
  return dynamic(() => import(`@outputs/${folderName}/page`), {
    loading: () => (
      <div className="p-6 text-gray-400">Loading {folderName}...</div>
    ),
  });
}

// ============ BADGE OVERLAY FOR SPECIAL COMPONENTS ============
interface BadgeOverlay {
  id: string;
  label?: string;
  rect: DOMRect;
}

function SpecialComponentBadges() {
  const { config } = useSpecialComponent();
  const [badges, setBadges] = useState<BadgeOverlay[]>([]);

  useEffect(() => {
    const updateBadges = () => {
      const newBadges: BadgeOverlay[] = [];
      const specialElements = document.querySelectorAll("[data-special-id]");

      specialElements.forEach((el) => {
        const id = el.getAttribute("data-special-id");
        if (id && config[id]?.hasBadge) {
          const rect = el.getBoundingClientRect();
          newBadges.push({
            id,
            label: config[id].label,
            rect,
          });
        }
      });

      setBadges(newBadges);
    };

    // Initial update
    updateBadges();

    // Update on scroll/resize
    window.addEventListener("scroll", updateBadges, true);
    window.addEventListener("resize", updateBadges);

    // Use MutationObserver to detect DOM changes
    const observer = new MutationObserver(updateBadges);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", updateBadges, true);
      window.removeEventListener("resize", updateBadges);
      observer.disconnect();
    };
  }, [config]);

  return (
    <>
      {badges.map((badge) => (
        <div
          key={badge.id}
          className="fixed pointer-events-none z-[9997]"
          style={{
            top: badge.rect.top - 4,
            left: badge.rect.right - 8,
          }}
        >
          <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
          {badge.label && (
            <div className="absolute -top-5 right-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap">
              {badge.label}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ============ AUTO INSPECTOR WRAPPER ============
function AutoInspector({ children }: { children: React.ReactNode }) {
  const { isEnabled, setHoveredElement } = useInspector();
  const { config, openContextMenu } = useSpecialComponent();
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
      const target = e.target as HTMLElement;
      // Check if clicked element or any parent has a special component ID
      let el: HTMLElement | null = target;
      while (el && el !== containerRef.current) {
        const specialId = el.getAttribute("data-special-id");
        if (specialId && config[specialId]?.hasBadge) {
          e.preventDefault();
          e.stopPropagation();
          openContextMenu(specialId);
          return;
        }
        el = el.parentElement;
      }
    };

    const container = containerRef.current;
    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick);
    };
  }, [isEnabled, setHoveredElement, config, openContextMenu]);

  return (
    <div ref={containerRef} className={isEnabled ? "cursor-crosshair" : ""}>
      {children}
      <SpecialComponentBadges />
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
      className="fixed pointer-events-none z-[9998] border-2 border-blue-500 bg-blue-500/10 transition-all duration-75"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-mono">
        {hoveredElement.tagName.toLowerCase()}
        {hoveredElement.id && `#${hoveredElement.id}`}
        {hoveredElement.className &&
          `.${hoveredElement.className.split(" ")[0]}`}
      </div>
    </div>
  );
}

// ============ LOADING SPINNER ============
function LoadingSpinner() {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="animate-spin h-4 w-4 text-blue-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
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
      <span className="text-gray-300 text-sm">Loading...</span>
    </div>
  );
}

// ============ INSPECTOR PANEL (in sidebar) ============
function InspectorPanel() {
  const { hoveredElement, isEnabled } = useInspector();

  if (!isEnabled) return null;

  return (
    <div className="border-t border-gray-700 p-3">
      <div className="text-xs text-blue-400 font-semibold mb-2">
        Element Inspector
      </div>
      <div className="text-xs font-mono text-gray-300 space-y-1 max-h-48 overflow-auto">
        {hoveredElement ? (
          <>
            <div>
              <span className="text-purple-400">Tag: </span>
              <span className="text-green-400">
                {hoveredElement.tagName.toLowerCase()}
              </span>
            </div>
            {hoveredElement.id && (
              <div>
                <span className="text-purple-400">ID: </span>
                <span className="text-yellow-400">#{hoveredElement.id}</span>
              </div>
            )}
            {hoveredElement.className && (
              <div>
                <span className="text-purple-400">Class: </span>
                <span className="text-orange-400 break-all">
                  .{hoveredElement.className.replace(/\s+/g, " .")}
                </span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-1 mt-1">
              <span className="text-blue-400 block mb-1">Box Model:</span>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <span className="text-gray-500">W: </span>
                  <span>{Math.round(hoveredElement.rect.width)}px</span>
                </div>
                <div>
                  <span className="text-gray-500">H: </span>
                  <span>{Math.round(hoveredElement.rect.height)}px</span>
                </div>
              </div>
            </div>
            {hoveredElement.computedStyle && (
              <div className="border-t border-gray-700 pt-1 mt-1">
                <span className="text-blue-400 block mb-1">Computed:</span>
                <div className="space-y-0.5">
                  <div>
                    <span className="text-gray-500">margin: </span>
                    <span className="text-orange-300">
                      {hoveredElement.computedStyle.margin}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">padding: </span>
                    <span className="text-green-300">
                      {hoveredElement.computedStyle.padding}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-500 italic">Hover to inspect</div>
        )}
      </div>
    </div>
  );
}

// ============ CONTEXT MENU PANEL (in sidebar) ============
function ContextMenuPanel() {
  const { contextMenu, closeContextMenu, config } = useSpecialComponent();

  useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [contextMenu.isOpen, closeContextMenu]);

  if (!contextMenu.isOpen || !contextMenu.targetId) return null;

  const componentConfig = config[contextMenu.targetId];

  return (
    <div className="border-t border-gray-700 p-3 bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-purple-400 font-semibold">
          Special Component
        </div>
        <button
          onClick={closeContextMenu}
          className="text-gray-500 hover:text-gray-300 text-xs"
        >
          Close
        </button>
      </div>
      <div className="text-xs font-mono text-gray-300">
        <div className="mb-2">
          <span className="text-gray-500">ID: </span>
          <span className="text-yellow-400">{contextMenu.targetId}</span>
        </div>
        {componentConfig?.label && (
          <div className="mb-2">
            <span className="text-gray-500">Label: </span>
            <span className="text-green-400">{componentConfig.label}</span>
          </div>
        )}
        <div className="mt-3">
          <LoadingSpinner />
        </div>
      </div>
    </div>
  );
}

// ============ NAVBAR COMPONENT ============
interface NavbarProps {
  state: NavbarState;
  onNavigate: (path: string) => void;
  isLoading: boolean;
}

function Navbar({ state, onNavigate, isLoading }: NavbarProps) {
  const { isEnabled, toggle } = useInspector();

  return (
    <div className="w-72 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white">Output Pages</h2>
        <p className="text-xs text-gray-500">Pages from outputs/ folder</p>
      </div>

      {/* Inspector Toggle */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={toggle}
          className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            isEnabled
              ? "bg-blue-600 text-white ring-2 ring-blue-400"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          <span>{isEnabled ? "Inspector ON" : "Inspector OFF"}</span>
        </button>
      </div>

      {/* Routes List */}
      <nav className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="text-gray-500 text-sm p-3">Loading outputs...</div>
        ) : state.routes.length === 0 ? (
          <div className="text-gray-500 text-sm p-3">
            No output pages found.
            <br />
            <span className="text-xs">Add folders with page.tsx to outputs/</span>
          </div>
        ) : (
          state.routes.map((route) => (
            <button
              key={route.path}
              onClick={() => onNavigate(route.path)}
              className={`w-full text-left px-3 py-2 rounded-md mb-1 transition-colors ${
                state.currentPath === route.path
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              {route.name}
            </button>
          ))
        )}
      </nav>

      {/* Inspector Panel */}
      <InspectorPanel />

      {/* Context Menu Panel */}
      <ContextMenuPanel />

      {/* Footer info */}
      <div className="p-3 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          {state.routes.length} page{state.routes.length !== 1 ? "s" : ""} found
        </p>
      </div>
    </div>
  );
}

// ============ PREVIEW COMPONENT ============
interface PreviewProps {
  router: ReturnType<typeof createMemoryRouter> | null;
}

function Preview({ router }: PreviewProps) {
  if (!router) {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-950 overflow-auto relative">
      <AutoInspector>
        <RouterProvider router={router} />
      </AutoInspector>
      <HighlightOverlay />
    </div>
  );
}

// ============ MAIN PAGE COMPONENT ============
export default function OutputRouterPage() {
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [router, setRouter] = useState<ReturnType<
    typeof createMemoryRouter
  > | null>(null);

  // Fetch routes from outputs folder on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const configs = await getOutputRouteConfigs();
        setRoutes(configs);

        if (configs.length > 0) {
          // Create route objects with dynamically imported components
          const routeObjects = configs.map((config) => {
            const folderName = config.path.replace(/^\//, "");
            const PageComponent = createDynamicPage(folderName);
            return {
              path: config.path,
              element: <PageComponent />,
            };
          });

          // Add a default route that redirects to first page
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
            configs[0].path === "/" ? routeObjects : [defaultRoute, ...routeObjects];

          const newRouter = createMemoryRouter(allRoutes, {
            initialEntries: [configs[0].path],
            initialIndex: 0,
          });

          newRouter.subscribe((state) => {
            setCurrentPath(state.location.pathname);
          });

          setRouter(newRouter);
          setCurrentPath(configs[0].path);
        }
      } catch (error) {
        console.error("Failed to load output routes:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadRoutes();
  }, []);

  // Handle navigation from navbar
  const handleNavigate = useCallback(
    (path: string) => {
      if (router) {
        router.navigate(path);
      }
    },
    [router]
  );

  const navbarState: NavbarState = {
    currentPath,
    routes,
  };

  return (
    <InspectorProvider>
      <SpecialComponentProvider>
        <div className="min-h-screen bg-gray-950 flex">
          <Navbar
            state={navbarState}
            onNavigate={handleNavigate}
            isLoading={isLoading}
          />
          <Preview router={router} />
        </div>
      </SpecialComponentProvider>
    </InspectorProvider>
  );
}

// ============ EXPORTED COMPONENTS FOR OUTPUT PAGES ============
// These can be used by pages in the outputs/ folder to mark special components

export function SpecialComponent({
  children,
  id,
}: {
  children: React.ReactNode;
  id: string;
}) {
  // This component wrapper allows output pages to mark components as special
  // The badge will show based on the special-components.json config
  return (
    <div data-special-id={id} className="relative">
      {children}
    </div>
  );
}

export { useInspector, useSpecialComponent };
