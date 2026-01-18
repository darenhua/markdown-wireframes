export interface RouteConfig {
  path: string;
  name: string;
  content: string;
}

export interface NavbarState {
  currentPath: string;
  routes: RouteConfig[];
}

// Inspector types
export interface InspectedElement {
  id: string;
  tagName: string;
  className: string;
  rect: DOMRect;
  computedStyle?: {
    margin: string;
    padding: string;
    border: string;
    width: string;
    height: string;
  };
}

export interface InspectorContextType {
  isEnabled: boolean;
  toggle: () => void;
  hoveredElement: InspectedElement | null;
  setHoveredElement: (el: InspectedElement | null) => void;
}

// Special component (dummy) types
export interface SpecialComponentConfig {
  [componentId: string]: {
    hasBadge: boolean;
    label?: string;
  };
}

export interface ContextMenuState {
  isOpen: boolean;
  targetId: string | null;
}
