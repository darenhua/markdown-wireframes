import { Tool, Resource, SchemaConstraint, Optional } from "@leanmcp/core";
import * as fs from "fs/promises";
import * as path from "path";
import { OUTPUTS_PATH } from "../../config.js";

// ============================================
// Input Classes
// ============================================

class PageNameInput {
  @SchemaConstraint({
    description: "Name of the page (folder name in outputs directory)",
    minLength: 1
  })
  pageName!: string;
}

class TaskContextInput {
  @SchemaConstraint({
    description: "Name of the page (folder name in outputs directory)",
    minLength: 1
  })
  pageName!: string;

  @Optional()
  @SchemaConstraint({
    description: "Optional task/component name. If provided, returns component-level context. Otherwise returns page-level context."
  })
  taskName?: string;
}

// ============================================
// Helper Functions
// ============================================

function getOutputsPath(): string {
  return OUTPUTS_PATH;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function safeReadJson(filePath: string): Promise<object | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function findContextFiles(basePath: string): Promise<Array<{name: string; path: string}>> {
  const tasks: Array<{name: string; path: string}> = [];

  async function scanDir(dirPath: string, relativePath: string = "") {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dirPath, entry.name);
          const newRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

          // Check if this directory has a context.md
          const contextPath = path.join(fullPath, "context.md");
          if (await fileExists(contextPath)) {
            // Extract component name from folder (remove parentheses if present)
            const name = entry.name.replace(/^\(|\)$/g, "");
            tasks.push({
              name,
              path: newRelativePath
            });
          }

          // Continue scanning subdirectories
          await scanDir(fullPath, newRelativePath);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  await scanDir(basePath);
  return tasks;
}

function extractComponentNames(registryContent: string): string[] {
  // Extract component names from registry export
  // Pattern: matches keys in "export const registry: ComponentRegistry = { Key: ... }"
  const componentPattern = /^\s*(\w+):/gm;
  const matches: string[] = [];
  let match;

  while ((match = componentPattern.exec(registryContent)) !== null) {
    matches.push(match[1]);
  }

  return matches;
}

// ============================================
// Service Class
// ============================================

export class TaskContextService {

  @Tool({
    description: "List all pages in the outputs folder with metadata about which files exist (page.tsx, tree.json, registry.tsx, context.md)",
    inputClass: class {}
  })
  async listPages() {
    const outputsPath = getOutputsPath();

    try {
      const entries = await fs.readdir(outputsPath, { withFileTypes: true });

      const pages = await Promise.all(
        entries
          .filter(entry => entry.isDirectory())
          .map(async (entry) => {
            const pagePath = path.join(outputsPath, entry.name);

            const [hasPage, hasTree, hasRegistry, hasContext] = await Promise.all([
              fileExists(path.join(pagePath, "page.tsx")),
              fileExists(path.join(pagePath, "tree.json")),
              fileExists(path.join(pagePath, "registry.tsx")),
              fileExists(path.join(pagePath, "context.md"))
            ]);

            return {
              name: entry.name,
              hasPage,
              hasTree,
              hasRegistry,
              hasContext
            };
          })
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            pages,
            totalCount: pages.length
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `Failed to list pages: ${error instanceof Error ? error.message : "Unknown error"}`,
            outputsPath
          }, null, 2)
        }]
      };
    }
  }

  @Tool({
    description: "Get the UI tree structure (tree.json content) for a specific page",
    inputClass: PageNameInput
  })
  async getPageStructure(input: PageNameInput) {
    const outputsPath = getOutputsPath();
    const treePath = path.join(outputsPath, input.pageName, "tree.json");

    const tree = await safeReadJson(treePath);

    if (tree === null) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `tree.json not found for page: ${input.pageName}`,
            searchedPath: treePath
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          pageName: input.pageName,
          tree
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "List all tasks (components with context.md files) within a page. Tasks are components that need implementation specs.",
    inputClass: PageNameInput
  })
  async listTasks(input: PageNameInput) {
    const outputsPath = getOutputsPath();
    const pagePath = path.join(outputsPath, input.pageName);

    // Check if page exists
    if (!await fileExists(pagePath)) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `Page not found: ${input.pageName}`,
            searchedPath: pagePath
          }, null, 2)
        }]
      };
    }

    // Check for page-level context.md
    const pageContextExists = await fileExists(path.join(pagePath, "context.md"));

    // Find all component-level context files
    const componentTasks = await findContextFiles(pagePath);

    // Build result
    const tasks = [];

    if (pageContextExists) {
      tasks.push({
        name: input.pageName,
        path: ".",
        type: "page"
      });
    }

    componentTasks.forEach(task => {
      tasks.push({
        name: task.name,
        path: task.path,
        type: "component"
      });
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          pageName: input.pageName,
          tasks,
          totalCount: tasks.length
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Get comprehensive context bundle for implementing a task. Returns context.md, page.tsx, tree.json, and registry.tsx content. This is the main tool for AI to get all info needed to implement a component.",
    inputClass: TaskContextInput
  })
  async getTaskContext(input: TaskContextInput) {
    const outputsPath = getOutputsPath();
    const pagePath = path.join(outputsPath, input.pageName);

    // Determine context path based on whether taskName is provided
    let contextPath: string;
    let contextType: "page" | "component";

    if (input.taskName) {
      // Component-level context - search for the task folder
      const componentTasks = await findContextFiles(pagePath);
      const task = componentTasks.find(t => t.name === input.taskName);

      if (task) {
        contextPath = path.join(pagePath, task.path, "context.md");
        contextType = "component";
      } else {
        contextPath = path.join(pagePath, input.taskName, "context.md");
        contextType = "component";
      }
    } else {
      // Page-level context
      contextPath = path.join(pagePath, "context.md");
      contextType = "page";
    }

    // Read all files
    const [contextMd, pageTsx, treeJson, registryTsx] = await Promise.all([
      safeReadFile(contextPath),
      safeReadFile(path.join(pagePath, "page.tsx")),
      safeReadJson(path.join(pagePath, "tree.json")),
      safeReadFile(path.join(pagePath, "registry.tsx"))
    ]);

    // Determine which files were found
    const filesFound: string[] = [];
    const filesMissing: string[] = [];

    if (contextMd !== null) filesFound.push("context.md");
    else filesMissing.push("context.md");

    if (pageTsx !== null) filesFound.push("page.tsx");
    else filesMissing.push("page.tsx");

    if (treeJson !== null) filesFound.push("tree.json");
    else filesMissing.push("tree.json");

    if (registryTsx !== null) filesFound.push("registry.tsx");
    else filesMissing.push("registry.tsx");

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          pageName: input.pageName,
          taskName: input.taskName || null,
          context: {
            contextMd,
            pageTsx,
            treeJson,
            registryTsx
          },
          metadata: {
            contextType,
            filesFound,
            filesMissing
          }
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Get the component registry (registry.tsx) for a specific page, showing all available component types that can be used",
    inputClass: PageNameInput
  })
  async getComponentRegistry(input: PageNameInput) {
    const outputsPath = getOutputsPath();
    const registryPath = path.join(outputsPath, input.pageName, "registry.tsx");

    const registry = await safeReadFile(registryPath);

    if (registry === null) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `registry.tsx not found for page: ${input.pageName}`,
            searchedPath: registryPath
          }, null, 2)
        }]
      };
    }

    // Extract component names
    const availableComponents = extractComponentNames(registry);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          pageName: input.pageName,
          registry,
          availableComponents
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Get the navigation graph (links.json) showing how pages link to each other",
    inputClass: class {}
  })
  async getNavigationGraph() {
    const outputsPath = getOutputsPath();
    const linksPath = path.join(outputsPath, "links.json");

    const links = await safeReadJson(linksPath);

    if (links === null) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: "links.json not found",
            searchedPath: linksPath
          }, null, 2)
        }]
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(links, null, 2)
      }]
    };
  }

  @Resource({
    description: "Get information about the task context server configuration"
  })
  async serverConfig() {
    return {
      contents: [{
        uri: "tasks://config",
        mimeType: "application/json",
        text: JSON.stringify({
          name: "task-context-server",
          version: "1.0.0",
          outputsPath: OUTPUTS_PATH,
          configured: true
        }, null, 2)
      }]
    };
  }
}
