"use server";

import { readdir, stat, mkdir, writeFile } from "fs/promises";
import path from "path";
import type { FileSystemNode, CreateItemFormData, ActionResult } from "./types";

// Base directory for the managed file system
const FS_ROOT = path.join(
  process.cwd(),
  "src/app/atoms/(components)/(starter)/building-real-fs/managed-fs"
);

// Recursively read directory and build tree
async function buildTree(dirPath: string): Promise<FileSystemNode[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const nodes: FileSystemNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(FS_ROOT, fullPath);

      if (entry.isDirectory()) {
        const children = await buildTree(fullPath);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "folder",
          children,
        });
      } else {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "file",
          isPage: entry.name === "page.tsx",
          isComponent: entry.name === "component.tsx",
          isContext: entry.name === "context.md",
        });
      }
    }

    // Sort: folders first (alphabetically), then files (alphabetically)
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch {
    return [];
  }
}

// Read the entire file system tree
export async function readFileSystem(): Promise<FileSystemNode[]> {
  // Ensure root directory exists
  try {
    await mkdir(FS_ROOT, { recursive: true });
  } catch {
    // Directory might already exist
  }

  return buildTree(FS_ROOT);
}

// Get all page.tsx files (for bolding in sidebar)
export async function getAllPages(): Promise<string[]> {
  const pages: string[] = [];

  async function findPages(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await findPages(fullPath);
        } else if (entry.name === "page.tsx") {
          pages.push(path.relative(FS_ROOT, fullPath));
        }
      }
    } catch {
      // Skip on error
    }
  }

  await findPages(FS_ROOT);
  return pages;
}

// Create a new item (page folder, component, or context file)
export async function createItem(formData: CreateItemFormData): Promise<ActionResult> {
  try {
    const { name, itemType, parentPath } = formData;

    // Sanitize the name
    const sanitizedName = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!sanitizedName) {
      return { success: false, message: "Invalid name" };
    }

    const parentDir = parentPath ? path.join(FS_ROOT, parentPath) : FS_ROOT;

    // Ensure parent exists
    await mkdir(parentDir, { recursive: true });

    if (itemType === "page") {
      // Create a page folder with page.tsx and context.md
      const folderName = `${sanitizedName}-page`;
      const folderPath = path.join(parentDir, folderName);

      await mkdir(folderPath, { recursive: true });

      // Create page.tsx
      const pageName = sanitizedName
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");

      const pageContent = `export default function ${pageName}Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">${name}</h1>
      <p className="text-gray-600 mt-2">This is the ${name} page.</p>
    </div>
  );
}
`;
      await writeFile(path.join(folderPath, "page.tsx"), pageContent, "utf-8");

      // Create context.md
      const contextContent = `# ${name} Page

## Purpose
Describe the purpose of this page.

## Components Used
- List components here

## Notes
Add any relevant notes.
`;
      await writeFile(path.join(folderPath, "context.md"), contextContent, "utf-8");

      return {
        success: true,
        message: `Page "${name}" created successfully`,
        node: {
          name: folderName,
          path: path.relative(FS_ROOT, folderPath),
          type: "folder",
          children: [
            { name: "page.tsx", path: path.relative(FS_ROOT, path.join(folderPath, "page.tsx")), type: "file", isPage: true },
            { name: "context.md", path: path.relative(FS_ROOT, path.join(folderPath, "context.md")), type: "file", isContext: true },
          ],
        },
      };
    } else if (itemType === "component") {
      // Check if we're in a (components) folder or need to create one
      const isInComponents = parentPath.includes("(components)");

      let componentDir: string;
      if (isInComponents) {
        // Create component directly in the (components) folder
        componentDir = path.join(parentDir, `(${sanitizedName}-component)`);
      } else {
        // Create (components) folder first, then the component
        const componentsDir = path.join(parentDir, "(components)");
        await mkdir(componentsDir, { recursive: true });
        componentDir = path.join(componentsDir, `(${sanitizedName}-component)`);
      }

      await mkdir(componentDir, { recursive: true });

      // Create component.tsx
      const componentName = sanitizedName
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");

      const componentContent = `export default function ${componentName}Component() {
  return (
    <div className="p-4">
      <span>${name} Component</span>
    </div>
  );
}
`;
      await writeFile(path.join(componentDir, "component.tsx"), componentContent, "utf-8");

      // Create context.md
      const contextContent = `# ${name} Component

## Purpose
Describe what this component does.

## Props
- List props here

## Usage
\`\`\`tsx
<${componentName}Component />
\`\`\`
`;
      await writeFile(path.join(componentDir, "context.md"), contextContent, "utf-8");

      return {
        success: true,
        message: `Component "${name}" created successfully`,
        node: {
          name: `(${sanitizedName}-component)`,
          path: path.relative(FS_ROOT, componentDir),
          type: "folder",
          children: [
            { name: "component.tsx", path: path.relative(FS_ROOT, path.join(componentDir, "component.tsx")), type: "file", isComponent: true },
            { name: "context.md", path: path.relative(FS_ROOT, path.join(componentDir, "context.md")), type: "file", isContext: true },
          ],
        },
      };
    } else if (itemType === "context") {
      // Just create a context.md file
      const contextPath = path.join(parentDir, "context.md");

      const contextContent = `# Context

## Overview
Describe the context here.

## Notes
Add any relevant notes.
`;
      await writeFile(contextPath, contextContent, "utf-8");

      return {
        success: true,
        message: `Context file created successfully`,
        node: {
          name: "context.md",
          path: path.relative(FS_ROOT, contextPath),
          type: "file",
          isContext: true,
        },
      };
    }

    return { success: false, message: "Invalid item type" };
  } catch (error) {
    console.error("Error creating item:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create item",
    };
  }
}

// Create a custom folder
export async function createFolder(name: string, parentPath: string): Promise<ActionResult> {
  try {
    const sanitizedName = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-()]/g, "");
    if (!sanitizedName) {
      return { success: false, message: "Invalid folder name" };
    }

    const parentDir = parentPath ? path.join(FS_ROOT, parentPath) : FS_ROOT;
    const folderPath = path.join(parentDir, sanitizedName);

    await mkdir(folderPath, { recursive: true });

    return {
      success: true,
      message: `Folder "${name}" created successfully`,
      node: {
        name: sanitizedName,
        path: path.relative(FS_ROOT, folderPath),
        type: "folder",
        children: [],
      },
    };
  } catch (error) {
    console.error("Error creating folder:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create folder",
    };
  }
}
