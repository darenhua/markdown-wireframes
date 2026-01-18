"use server";

import { writeFile, readdir, mkdir } from "fs/promises";
import path from "path";
import type { UITree, FileSystemNode, ActionResult } from "./types";

// Base directory for exported pages
const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");

/**
 * Converts a json-render tree to TSX code
 */
function treeToTSX(tree: UITree): string {
  const usedComponents = new Set<string>();

  // Collect all used component types
  for (const element of Object.values(tree.elements)) {
    usedComponents.add(element.type);
  }

  // Generate JSX for an element recursively
  function elementToJSX(elementKey: string, indent = 2): string {
    const element = tree.elements[elementKey];
    if (!element) return "";

    const spaces = " ".repeat(indent);
    const props = serializeProps(element.props);
    const hasChildren = element.children && element.children.length > 0;

    if (hasChildren) {
      const childrenJSX = element.children!
        .map((childKey) => elementToJSX(childKey, indent + 2))
        .join("\n");
      return `${spaces}<${element.type}${props ? ` ${props}` : ""}>\n${childrenJSX}\n${spaces}</${element.type}>`;
    }
    return `${spaces}<${element.type}${props ? ` ${props}` : ""} />`;
  }

  // Serialize props to JSX attribute format
  function serializeProps(props: Record<string, unknown>): string {
    const entries = Object.entries(props).filter(
      ([, value]) => value !== null && value !== undefined
    );

    return entries
      .map(([key, value]) => {
        if (typeof value === "string") {
          return `${key}="${escapeString(value)}"`;
        }
        if (typeof value === "boolean") {
          return value ? key : `${key}={false}`;
        }
        if (typeof value === "number") {
          return `${key}={${value}}`;
        }
        if (Array.isArray(value)) {
          return `${key}={${JSON.stringify(value)}}`;
        }
        if (typeof value === "object") {
          return `${key}={${JSON.stringify(value)}}`;
        }
        return `${key}={${JSON.stringify(value)}}`;
      })
      .join(" ");
  }

  // Escape special characters in strings
  function escapeString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  const componentImports = Array.from(usedComponents).sort().join(", ");
  const rootJSX = elementToJSX(tree.root);

  return `"use client";

/**
 * Auto-generated component from json-render tree
 * Generated at: ${new Date().toISOString()}
 */

// Import your component implementations from your registry
// Adjust this import path based on your project structure
import { ${componentImports} } from "./components";

export default function GeneratedPage() {
  return (
${rootJSX}
  );
}
`;
}

/**
 * Exports the tree as TSX and JSON to outputs/{folderName}/
 */
export async function exportTreeToFolder(
  tree: UITree,
  folderName: string
): Promise<ActionResult> {
  try {
    // Sanitize folder name
    const sanitizedName = folderName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

    if (!sanitizedName) {
      return { success: false, message: "Invalid folder name" };
    }

    const folderPath = path.join(OUTPUTS_ROOT, sanitizedName);

    // Create the folder
    await mkdir(folderPath, { recursive: true });

    // Generate TSX code
    const tsxCode = treeToTSX(tree);

    // Write page.tsx
    await writeFile(path.join(folderPath, "page.tsx"), tsxCode, "utf-8");

    // Write tree.json
    await writeFile(
      path.join(folderPath, "tree.json"),
      JSON.stringify(tree, null, 2),
      "utf-8"
    );

    return {
      success: true,
      message: `Exported to outputs/${sanitizedName}/`,
      path: `outputs/${sanitizedName}`,
      node: {
        name: sanitizedName,
        path: sanitizedName,
        type: "folder",
        children: [
          { name: "page.tsx", path: `${sanitizedName}/page.tsx`, type: "file", isPage: true },
          { name: "tree.json", path: `${sanitizedName}/tree.json`, type: "file", isJson: true },
        ],
      },
    };
  } catch (error) {
    console.error("Error exporting:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Reads the outputs directory structure
 */
export async function readOutputsDirectory(): Promise<FileSystemNode[]> {
  try {
    // Ensure outputs directory exists
    await mkdir(OUTPUTS_ROOT, { recursive: true });

    const entries = await readdir(OUTPUTS_ROOT, { withFileTypes: true });
    const nodes: FileSystemNode[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(OUTPUTS_ROOT, entry.name);
        const children: FileSystemNode[] = [];

        try {
          const files = await readdir(folderPath, { withFileTypes: true });
          for (const file of files) {
            if (file.isFile()) {
              children.push({
                name: file.name,
                path: `${entry.name}/${file.name}`,
                type: "file",
                isPage: file.name === "page.tsx",
                isJson: file.name === "tree.json",
              });
            }
          }
        } catch {
          // Skip if can't read folder
        }

        nodes.push({
          name: entry.name,
          path: entry.name,
          type: "folder",
          children,
        });
      }
    }

    // Sort alphabetically
    nodes.sort((a, b) => a.name.localeCompare(b.name));

    return nodes;
  } catch {
    return [];
  }
}

// Legacy export for backwards compatibility
export async function exportTreeToTSX(tree: UITree): Promise<ActionResult> {
  return exportTreeToFolder(tree, "generated");
}
