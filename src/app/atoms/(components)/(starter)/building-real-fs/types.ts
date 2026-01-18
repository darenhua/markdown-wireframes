// File system node representing a file or folder
export interface FileSystemNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileSystemNode[];
  isPage?: boolean; // true if it's a page.tsx
  isComponent?: boolean; // true if it's a component.tsx
  isContext?: boolean; // true if it's a context.md
}

// Form data for creating new items
export interface CreateItemFormData {
  name: string;
  itemType: "page" | "component" | "context";
  parentPath: string;
}

// Action results
export interface ActionResult {
  success: boolean;
  message: string;
  node?: FileSystemNode;
}

// Tree state for UI
export interface TreeState {
  expandedPaths: Set<string>;
  selectedPath: string | null;
}
