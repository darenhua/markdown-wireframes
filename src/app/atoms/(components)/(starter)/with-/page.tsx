"use client";

import React, { useState, useCallback, useEffect } from "react";
import type { RouteConfig, NavbarState } from "./types";
import { getOutputRouteConfigs } from "./action";
import { toAppRoutes, type AppRoute } from "./routes";

// ============ NAVBAR COMPONENT ============
interface NavbarProps {
  state: NavbarState;
  onNavigate: (path: string) => void;
  isLoading: boolean;
}

function Navbar({ state, onNavigate, isLoading }: NavbarProps) {
  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white">Output Pages</h2>
        <p className="text-xs text-gray-500">Pages from outputs/ folder</p>
      </div>

      {/* Routes List */}
      <nav className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="text-gray-500 text-sm p-3">Loading outputs...</div>
        ) : state.routes.length === 0 ? (
          <div className="text-gray-500 text-sm p-3">
            No output pages found.
            <br />
            <span className="text-xs">
              Add folders with page.tsx to outputs/
            </span>
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
  currentRoute: AppRoute | null;
}

function Preview({ currentRoute }: PreviewProps) {
  if (!currentRoute) {
    return (
      <div className="flex-1 bg-gray-950 flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <p className="text-lg mb-2">Select a page to preview</p>
          <p className="text-sm">Choose from the sidebar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-950 overflow-hidden">
      <iframe
        key={currentRoute.iframeSrc}
        src={currentRoute.iframeSrc}
        className="w-full h-full border-0"
        title={`Preview: ${currentRoute.name}`}
      />
    </div>
  );
}

// ============ MAIN PAGE COMPONENT ============
export default function OutputRouterPage() {
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [appRoutes, setAppRoutes] = useState<AppRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch routes from outputs folder on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const configs = await getOutputRouteConfigs();
        setRoutes(configs);
        setAppRoutes(toAppRoutes(configs));
        // Auto-select first route if available
        if (configs.length > 0) {
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
  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  // Get current route for preview
  const currentRoute = currentPath
    ? appRoutes.find((r) => r.path === currentPath) ?? null
    : null;

  const navbarState: NavbarState = {
    currentPath: currentPath ?? "",
    routes,
  };

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Navbar
        state={navbarState}
        onNavigate={handleNavigate}
        isLoading={isLoading}
      />
      <Preview currentRoute={currentRoute} />
    </div>
  );
}
