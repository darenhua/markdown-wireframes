"use client";

import React, { useState, useCallback, useTransition, useEffect } from "react";
import {
  createMemoryRouter,
  RouterProvider,
} from "react-router-dom";
import type { RouteConfig, NavbarState, AddRouteFormData } from "./types";
import { addRoute } from "./action";
import {
  appRoutes,
  initialRouteConfigs,
  type AppRoute,
} from "./routes";

// ============ DYNAMIC ROUTE COMPONENT ============
function DynamicPage({ content, name }: { content: string; name: string }) {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-4">{name}</h1>
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="text-gray-300 whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}

// ============ NAVBAR COMPONENT ============
interface NavbarProps {
  state: NavbarState;
  onNavigate: (path: string) => void;
  onAddRoute: (route: RouteConfig) => void;
}

function Navbar({ state, onNavigate, onAddRoute }: NavbarProps) {
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [formData, setFormData] = useState<AddRouteFormData>({
    name: "",
    path: "",
    content: "",
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      startTransition(async () => {
        const result = await addRoute(formData);
        if (result.success && result.route) {
          onAddRoute(result.route);
          setFormData({ name: "", path: "", content: "" });
          setIsAddingRoute(false);
        } else {
          setError(result.message);
        }
      });
    },
    [formData, onAddRoute]
  );

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-bold text-white">React Router</h2>
        <p className="text-xs text-gray-500">Client-side routing demo</p>
      </div>

      {/* Routes List */}
      <nav className="flex-1 overflow-auto p-2">
        {state.routes.map((route) => (
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
        ))}
      </nav>

      {/* Add Route Button / Form */}
      <div className="p-3 border-t border-gray-700">
        {isAddingRoute ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              type="text"
              placeholder="Route name"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
              required
            />
            <input
              type="text"
              placeholder="Path (e.g., /contact)"
              value={formData.path}
              onChange={(e) => setFormData((f) => ({ ...f, path: e.target.value }))}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-500"
              required
            />
            <textarea
              placeholder="Page content..."
              value={formData.content}
              onChange={(e) => setFormData((f) => ({ ...f, content: e.target.value }))}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-sm placeholder-gray-500 resize-none"
              rows={3}
              required
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                onClick={() => setIsAddingRoute(false)}
                className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingRoute(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
          >
            <span className="text-xl leading-none">+</span>
            <span>Add Route</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ============ PREVIEW COMPONENT ============
interface PreviewProps {
  router: ReturnType<typeof createMemoryRouter>;
}

function Preview({ router }: PreviewProps) {
  return (
    <div className="flex-1 bg-gray-950 overflow-auto">
      <RouterProvider router={router} />
    </div>
  );
}

// ============ MAIN PAGE COMPONENT ============
export default function ReactRouterPage() {
  const [currentPath, setCurrentPath] = useState("/");
  const [routes, setRoutes] = useState<RouteConfig[]>(initialRouteConfigs);
  const [dynamicRoutes, setDynamicRoutes] = useState<AppRoute[]>([]);
  const [router, setRouter] = useState<ReturnType<typeof createMemoryRouter> | null>(null);

  // Get component for a route - checks appRoutes first, then dynamic routes
  const getComponentForRoute = useCallback(
    (route: RouteConfig) => {
      // Check static routes from routes.tsx
      const staticRoute = appRoutes.find((r) => r.path === route.path);
      if (staticRoute) {
        return staticRoute.element;
      }
      // Check dynamically added routes
      const dynamicRoute = dynamicRoutes.find((r) => r.path === route.path);
      if (dynamicRoute) {
        return dynamicRoute.element;
      }
      // Fallback for unknown routes
      return <DynamicPage content={route.content} name={route.name} />;
    },
    [dynamicRoutes]
  );

  // Create/recreate router when routes change
  useEffect(() => {
    const routeConfigs = routes.map((route) => ({
      path: route.path,
      element: getComponentForRoute(route),
    }));

    const newRouter = createMemoryRouter(routeConfigs, {
      initialEntries: [currentPath],
      initialIndex: 0,
    });

    // Subscribe to route changes
    const unsubscribe = newRouter.subscribe((state) => {
      setCurrentPath(state.location.pathname);
    });

    setRouter(newRouter);

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, getComponentForRoute]);

  // Handle navigation from navbar
  const handleNavigate = useCallback(
    (path: string) => {
      if (router) {
        router.navigate(path);
      }
    },
    [router]
  );

  // Handle adding a new route
  const handleAddRoute = useCallback((route: RouteConfig) => {
    setRoutes((prev) => [...prev, route]);
    // Add to dynamic routes with the DynamicPage component
    setDynamicRoutes((prev) => [
      ...prev,
      {
        path: route.path,
        name: route.name,
        element: <DynamicPage content={route.content} name={route.name} />,
        content: route.content,
      },
    ]);
  }, []);

  const navbarState: NavbarState = {
    currentPath,
    routes,
  };

  if (!router) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Navbar
        state={navbarState}
        onNavigate={handleNavigate}
        onAddRoute={handleAddRoute}
      />
      <Preview router={router} />
    </div>
  );
}
