"use server";

import { readFile, writeFile, mkdir, access, readdir } from "fs/promises";
import path from "path";
import type { UITree } from "@json-render/core";

const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");
const LINKS_JSON_PATH = path.join(OUTPUTS_ROOT, "links.json");

// ============ LINKS GRAPH TYPES ============
export interface LinkEdge {
  from: string;
  to: string;
  elementKey?: string;
  elementText?: string;
}

export interface LinksGraph {
  nodes: string[];
  edges: LinkEdge[];
}

export interface OutputFileNode {
  name: string;
  path: string;
  type: "folder" | "file";
  isPage?: boolean;
  isTree?: boolean;
  isRegistry?: boolean;
  children?: OutputFileNode[];
  linksTo?: string[];
  linkedFrom?: string[];
}

/**
 * Converts a json-render tree to TSX code with actual JSX components
 */
function treeToTSX(tree: UITree): string {
  const usedComponents = new Set<string>();

  // First pass: collect all used component types
  for (const element of Object.values(tree.elements)) {
    usedComponents.add(element.type);
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

  // Generate JSX recursively
  function elementToJSX(elementKey: string, indent = 4): string {
    const element = tree.elements[elementKey];
    if (!element) return "";

    const spaces = " ".repeat(indent);
    const componentName = `Render${element.type}`;
    const propsStr = serializeProps(element.props);
    const hasChildren = element.children && element.children.length > 0;

    if (hasChildren) {
      const childrenJSX = element.children!
        .map((childKey) => elementToJSX(childKey, indent + 2))
        .join("\n");
      return `${spaces}<${componentName}${propsStr ? ` ${propsStr}` : ""}>\n${childrenJSX}\n${spaces}</${componentName}>`;
    }
    return `${spaces}<${componentName}${propsStr ? ` ${propsStr}` : ""} />`;
  }

  // Build import statements
  const componentImports = Array.from(usedComponents)
    .map((c) => `Render${c}`)
    .sort()
    .join(", ");

  const rootJSX = elementToJSX(tree.root);

  return `"use client";

import { ${componentImports} } from "@/lib/render-components";

export default function GeneratedPage() {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-4 min-w-full">
${rootJSX}
      </div>
    </div>
  );
}
`;
}

/**
 * Loads tree.json for a given folder from outputs directory
 */
export async function loadTreeJson(folderName: string): Promise<UITree | null> {
  try {
    // Sanitize folder name to prevent path traversal
    const sanitizedFolder = folderName.replace(/[^a-zA-Z0-9-_]/g, "");
    if (!sanitizedFolder) return null;

    const treePath = path.join(OUTPUTS_ROOT, sanitizedFolder, "tree.json");

    // Check if file exists
    try {
      await access(treePath);
    } catch {
      return null;
    }

    // Read and parse the tree.json file
    const content = await readFile(treePath, "utf-8");
    return JSON.parse(content) as UITree;
  } catch (error) {
    console.error("Error loading tree.json:", error);
    return null;
  }
}

/**
 * Saves tree.json, page.tsx, and registry.tsx for a given folder to outputs directory
 */
export async function saveTreeJson(
  tree: UITree,
  folderName: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Sanitize folder name
    const sanitizedFolder = folderName.replace(/[^a-zA-Z0-9-_]/g, "");
    if (!sanitizedFolder) {
      return { success: false, message: "Invalid folder name" };
    }

    const folderPath = path.join(OUTPUTS_ROOT, sanitizedFolder);

    // Ensure folder exists
    await mkdir(folderPath, { recursive: true });

    // Write tree.json
    const treePath = path.join(folderPath, "tree.json");
    await writeFile(treePath, JSON.stringify(tree, null, 2), "utf-8");

    // Write page.tsx with actual JSX code (no registry needed)
    const pagePath = path.join(folderPath, "page.tsx");
    await writeFile(pagePath, treeToTSX(tree), "utf-8");

    return {
      success: true,
      message: `Saved to outputs/${sanitizedFolder}/`,
    };
  } catch (error) {
    console.error("Error saving tree.json:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Gets the next available page number for auto-naming
 */
async function getNextPageNumber(): Promise<number> {
  try {
    await mkdir(OUTPUTS_ROOT, { recursive: true });
    const entries = await readdir(OUTPUTS_ROOT, { withFileTypes: true });

    // Find all folders matching "page-N" pattern
    const pageNumbers = entries
      .filter((e) => e.isDirectory())
      .map((e) => {
        const match = e.name.match(/^page-(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    // Return the next number
    return pageNumbers.length > 0 ? Math.max(...pageNumbers) + 1 : 1;
  } catch {
    return 1;
  }
}

/**
 * Creates a new page folder with empty/default tree
 * Returns the folder name for navigation
 */
export async function createNewPage(
  tree?: UITree,
  customFolderName?: string
): Promise<{ success: boolean; message: string; folderName?: string }> {
  try {
    // Generate folder name
    let folderName: string;
    if (customFolderName) {
      folderName = customFolderName.replace(/[^a-zA-Z0-9-_]/g, "");
    } else {
      const nextNum = await getNextPageNumber();
      folderName = `page-${nextNum}`;
    }

    if (!folderName) {
      return { success: false, message: "Invalid folder name" };
    }

    const folderPath = path.join(OUTPUTS_ROOT, folderName);

    // Ensure folder exists
    await mkdir(folderPath, { recursive: true });

    // Only write tree.json and page.tsx if a tree was explicitly provided
    if (tree) {
      const treePath = path.join(folderPath, "tree.json");
      await writeFile(treePath, JSON.stringify(tree, null, 2), "utf-8");

      const pagePath = path.join(folderPath, "page.tsx");
      await writeFile(pagePath, treeToTSX(tree), "utf-8");
    }

    // Add the new page to the links graph
    await addNodeToGraph(folderName);

    return {
      success: true,
      message: `Created outputs/${folderName}/`,
      folderName,
    };
  } catch (error) {
    console.error("Error creating new page:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Lists all page folders in outputs directory
 */
export async function listPageFolders(): Promise<string[]> {
  try {
    await mkdir(OUTPUTS_ROOT, { recursive: true });
    const entries = await readdir(OUTPUTS_ROOT, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Element match criteria for finding elements in tree
 */
interface ElementMatchCriteria {
  id?: string;
  className?: string;
  tagName?: string;
  textContent?: string;
}

/**
 * Finds an element in the tree that matches the given criteria
 * Returns the key of the matching element
 */
function findMatchingElement(
  tree: UITree,
  criteria: ElementMatchCriteria
): string | null {
  const { tagName, textContent, className } = criteria;

  // Map common HTML tag names to json-render types
  const tagTypeMap: Record<string, string[]> = {
    BUTTON: ["Button", "LinkButton"],
    DIV: ["Box", "Card", "Stack", "Grid"],
    P: ["Text"],
    H1: ["Heading"],
    H2: ["Heading"],
    H3: ["Heading"],
    H4: ["Heading"],
    SPAN: ["Badge", "Text"],
  };

  const possibleTypes = tagName ? tagTypeMap[tagName.toUpperCase()] || [] : [];

  for (const [key, element] of Object.entries(tree.elements)) {
    // Check if type matches
    if (possibleTypes.length > 0 && !possibleTypes.includes(element.type)) {
      continue;
    }

    // Check if label/text matches for Button
    if (element.type === "Button" || element.type === "LinkButton") {
      if (textContent && element.props.label === textContent) {
        return key;
      }
    }

    // Check if text matches for Text/Heading
    if (element.type === "Text" || element.type === "Heading") {
      if (textContent && element.props.text === textContent) {
        return key;
      }
    }

    // Check if badge text matches
    if (element.type === "Badge") {
      if (textContent && element.props.text === textContent) {
        return key;
      }
    }
  }

  return null;
}

/**
 * Adds a linkTo property to an element in the tree
 * Returns the modified tree if successful
 */
export async function addLinkToElement(
  folderName: string,
  matchCriteria: ElementMatchCriteria,
  targetPath: string
): Promise<{ success: boolean; message: string; tree?: UITree }> {
  try {
    // Load the current tree
    const tree = await loadTreeJson(folderName);
    if (!tree) {
      return { success: false, message: "Could not load tree.json" };
    }

    // Find the matching element
    const elementKey = findMatchingElement(tree, matchCriteria);
    if (!elementKey) {
      return {
        success: false,
        message: "Could not find matching element in tree",
      };
    }

    // Add linkTo prop to the element
    const element = tree.elements[elementKey];
    element.props.linkTo = targetPath;

    // Save the updated tree
    const saveResult = await saveTreeJson(tree, folderName);
    if (!saveResult.success) {
      return { success: false, message: saveResult.message };
    }

    // Update the links graph
    const targetFolder = targetPath.replace(/^\//, "");
    await addLinkToGraph(folderName, targetFolder, elementKey, matchCriteria.textContent);

    return {
      success: true,
      message: `Added link to ${targetPath} on element ${elementKey}`,
      tree,
    };
  } catch (error) {
    console.error("Error adding link to element:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============ LINKS GRAPH FUNCTIONS ============

/**
 * Reads the links.json graph file
 */
export async function readLinksGraph(): Promise<LinksGraph> {
  try {
    await mkdir(OUTPUTS_ROOT, { recursive: true });

    try {
      await access(LINKS_JSON_PATH);
      const content = await readFile(LINKS_JSON_PATH, "utf-8");
      return JSON.parse(content) as LinksGraph;
    } catch {
      // File doesn't exist, return empty graph
      return { nodes: [], edges: [] };
    }
  } catch {
    return { nodes: [], edges: [] };
  }
}

/**
 * Writes the links.json graph file
 */
async function writeLinksGraph(graph: LinksGraph): Promise<void> {
  await mkdir(OUTPUTS_ROOT, { recursive: true });
  await writeFile(LINKS_JSON_PATH, JSON.stringify(graph, null, 2), "utf-8");
}

/**
 * Adds a node to the links graph if it doesn't exist
 */
export async function addNodeToGraph(folderName: string): Promise<void> {
  const graph = await readLinksGraph();

  if (!graph.nodes.includes(folderName)) {
    graph.nodes.push(folderName);
    graph.nodes.sort();
    await writeLinksGraph(graph);
  }
}

/**
 * Adds a link/edge to the graph
 */
export async function addLinkToGraph(
  fromFolder: string,
  toFolder: string,
  elementKey?: string,
  elementText?: string
): Promise<void> {
  const graph = await readLinksGraph();

  // Ensure both nodes exist
  if (!graph.nodes.includes(fromFolder)) {
    graph.nodes.push(fromFolder);
  }
  if (!graph.nodes.includes(toFolder)) {
    graph.nodes.push(toFolder);
  }
  graph.nodes.sort();

  // Check if edge already exists
  const existingEdge = graph.edges.find(
    (e) => e.from === fromFolder && e.to === toFolder
  );

  if (!existingEdge) {
    graph.edges.push({
      from: fromFolder,
      to: toFolder,
      elementKey,
      elementText,
    });
  }

  await writeLinksGraph(graph);
}

/**
 * Reads the outputs directory structure with link information
 */
export async function readOutputsFileSystem(): Promise<OutputFileNode[]> {
  try {
    await mkdir(OUTPUTS_ROOT, { recursive: true });

    const graph = await readLinksGraph();
    const entries = await readdir(OUTPUTS_ROOT, { withFileTypes: true });
    const nodes: OutputFileNode[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderPath = path.join(OUTPUTS_ROOT, entry.name);
        const children: OutputFileNode[] = [];

        try {
          const files = await readdir(folderPath, { withFileTypes: true });
          for (const file of files) {
            if (file.isFile()) {
              const isPage = file.name === "page.tsx";
              const isTree = file.name === "tree.json";
              // Only include page.tsx and tree.json, filter out registry.tsx
              if (isPage || isTree) {
                children.push({
                  name: file.name,
                  path: `${entry.name}/${file.name}`,
                  type: "file",
                  isPage,
                  isTree,
                });
              }
            }
          }
        } catch {
          // Skip if can't read folder
        }

        // Get link information from graph
        const linksTo = graph.edges
          .filter((e) => e.from === entry.name)
          .map((e) => e.to);
        const linkedFrom = graph.edges
          .filter((e) => e.to === entry.name)
          .map((e) => e.from);

        nodes.push({
          name: entry.name,
          path: entry.name,
          type: "folder",
          children,
          linksTo: linksTo.length > 0 ? linksTo : undefined,
          linkedFrom: linkedFrom.length > 0 ? linkedFrom : undefined,
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
