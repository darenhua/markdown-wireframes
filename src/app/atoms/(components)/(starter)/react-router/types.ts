export interface RouteConfig {
  path: string;
  name: string;
  content: string;
}

export interface NavbarState {
  currentPath: string;
  routes: RouteConfig[];
}

export interface AddRouteFormData {
  name: string;
  path: string;
  content: string;
}

export interface ActionResult {
  success: boolean;
  message: string;
  route?: RouteConfig;
}
