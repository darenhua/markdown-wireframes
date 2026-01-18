"use client";

import React, { useState, useCallback, useEffect } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import dynamic from "next/dynamic";
import type { RouteConfig, NavbarState } from "./types";
import { getOutputRouteConfigs } from "./action";

// ============ DYNAMIC IMPORTS FOR OUTPUT PAGES ============
// Uses webpack's dynamic import with a pattern to include all output pages
function createDynamicPage(folderName: string) {
  return dynamic(
    () => import(`@outputs/${folderName}/page`),
    {
      loading: () => (
        <div className="p-6 text-gray-400">Loading {folderName}...</div>
      ),
    }
  );
}

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
    <div className="flex-1 bg-gray-950 overflow-auto">
      <RouterProvider router={router} />
    </div>
  );
}

// ============ MAIN PAGE COMPONENT ============
export default function OutputRouterPage() {
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [router, setRouter] = useState<ReturnType<typeof createMemoryRouter> | null>(null);

  // Fetch routes from outputs folder on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const configs = await getOutputRouteConfigs();
        setRoutes(configs);

        if (configs.length > 0) {
          // Create route objects with dynamically imported components
          const routeObjects = configs.map((config) => {
            const folderName = config.path.replace(/^\//, ""); // Remove leading slash
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
              const FirstPage = createDynamicPage(configs[0].path.replace(/^\//, ""));
              return <FirstPage />;
            })(),
          };

          const allRoutes = configs[0].path === "/" ? routeObjects : [defaultRoute, ...routeObjects];

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
    <div className="min-h-screen bg-gray-950 flex">
      <Navbar
        state={navbarState}
        onNavigate={handleNavigate}
        isLoading={isLoading}
      />
      <Preview router={router} />
    </div>
  );
}
