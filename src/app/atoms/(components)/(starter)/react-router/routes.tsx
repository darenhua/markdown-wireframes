import type { RouteObject } from "react-router-dom";
import type { RouteConfig } from "./types";

// Import page components
import HomePage from "./pages/home";
import AboutPage from "./pages/about";
import SettingsPage from "./pages/settings";
import DashboardPage from "./pages/dashboard";

// ============ ROUTE DEFINITIONS ============
// This is the single source of truth for all routes.
// Each route maps a path to its component and metadata.

export interface AppRoute {
  path: string;
  name: string;
  element: React.ReactNode;
  content?: string; // For dynamic routes
}

export const appRoutes: AppRoute[] = [
  { path: "/", name: "Home", element: <HomePage /> },
  { path: "/about", name: "About", element: <AboutPage /> },
  { path: "/dashboard", name: "Dashboard", element: <DashboardPage /> },
  { path: "/settings", name: "Settings", element: <SettingsPage /> },
];

// Convert AppRoute[] to RouteObject[] for react-router
export function toRouteObjects(routes: AppRoute[]): RouteObject[] {
  return routes.map((route) => ({
    path: route.path,
    element: route.element,
  }));
}

// Convert AppRoute[] to RouteConfig[] for navbar metadata
export function toRouteConfigs(routes: AppRoute[]): RouteConfig[] {
  return routes.map((route) => ({
    path: route.path,
    name: route.name,
    content: route.content ?? "",
  }));
}

// Initial routes for the router
export const initialRouteObjects = toRouteObjects(appRoutes);
export const initialRouteConfigs = toRouteConfigs(appRoutes);
