export interface RouteConfig {
  path: string;
  name: string;
  content: string;
}

export interface NavbarState {
  currentPath: string;
  routes: RouteConfig[];
}
