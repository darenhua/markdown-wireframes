// File system node representing a file or folder
export interface FileSystemNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileSystemNode[];
  isPage?: boolean;
  isJson?: boolean;
}

// Tree element from json-render
export interface TreeElement {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

// UI Tree structure
export interface UITree {
  root: string;
  elements: Record<string, TreeElement>;
}

// Action results
export interface ActionResult {
  success: boolean;
  message: string;
  path?: string;
  node?: FileSystemNode;
}
