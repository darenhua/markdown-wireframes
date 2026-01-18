import type { RouteConfig } from "./types";

// Routes are now dynamically loaded from the outputs/ folder
// See action.ts getOutputRouteConfigs() for the server action

export interface AppRoute {
  path: string;
  name: string;
  iframeSrc: string;
}

// Convert RouteConfig[] to AppRoute[] with iframe sources
export function toAppRoutes(configs: RouteConfig[]): AppRoute[] {
  return configs.map((config) => ({
    path: config.path,
    name: config.name,
    iframeSrc: `/outputs${config.path}`,
  }));
}
