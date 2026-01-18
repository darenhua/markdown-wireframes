"use server";

import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");
const TODOS_FILE = path.join(OUTPUTS_ROOT, "todos.json");

// ============ Types ============

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  pageName: string;
  elementName?: string;
  contextPath?: string;
  taskPrompt?: string;
  createdAt: string;
  completedAt?: string;
}

interface TodosData {
  todos: Todo[];
  lastUpdated: string;
}

interface ComponentRef {
  id: string;
  selectors: {
    elementKey?: string;
    tagName?: string;
    className?: string;
    textContent?: string;
  };
  contextPath: string;
  createdAt: string;
  lastUpdated: string;
}

interface ComponentRefsIndex {
  components: Record<string, ComponentRef>;
}

// ============ Helpers ============

function generateTodoId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ============ Read Todos ============

export async function readTodos(): Promise<Todo[]> {
  try {
    await mkdir(OUTPUTS_ROOT, { recursive: true });

    if (!existsSync(TODOS_FILE)) {
      return [];
    }

    const data = await safeReadJson<TodosData>(TODOS_FILE);
    return data?.todos || [];
  } catch (error) {
    console.error("[todo-actions] Error reading todos:", error);
    return [];
  }
}

export async function getTodosByPage(pageName: string): Promise<Todo[]> {
  const todos = await readTodos();
  return todos.filter(t => t.pageName === pageName);
}

// ============ Write Todos ============

async function writeTodos(todos: Todo[]): Promise<void> {
  await mkdir(OUTPUTS_ROOT, { recursive: true });

  const data: TodosData = {
    todos,
    lastUpdated: new Date().toISOString()
  };

  await writeFile(TODOS_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// ============ Generate Task Prompt ============

async function generateTaskPrompt(
  pageName: string,
  elementName: string,
  contextPath: string
): Promise<string> {
  const pagePath = path.join(OUTPUTS_ROOT, pageName);

  // Read page files
  const pageTsx = await safeReadFile(path.join(pagePath, "page.tsx"));
  const contextMd = await safeReadFile(path.join(pagePath, contextPath));
  const treeJson = await safeReadJson(path.join(pagePath, "tree.json"));
  const componentRefs = await safeReadJson<ComponentRefsIndex>(
    path.join(pagePath, "component-refs.json")
  );

  const prompt = `# Task: Implement "${elementName}" Component

## Page Context
You are building a component for the page "${pageName}".

### Current Page TSX
\`\`\`tsx
${pageTsx || "// Page file not found"}
\`\`\`

### Component Specification
${contextMd || "// No context/spec file found"}

### UI Tree Structure
\`\`\`json
${treeJson ? JSON.stringify(treeJson, null, 2) : "// Tree file not found"}
\`\`\`

${componentRefs ? `### Component References
\`\`\`json
${JSON.stringify(componentRefs, null, 2)}
\`\`\`
` : ""}
## Instructions
1. Review the component specification above to understand the requirements
2. Look at the page TSX to see how this component fits into the overall page
3. Use the UI tree structure to understand the component hierarchy
4. Implement the "${elementName}" component according to the spec
5. Ensure the component integrates properly with the existing page structure

Please implement this component following the specification and ensuring it works within the page context.`;

  return prompt;
}

// ============ Sync Todos from Specs ============

export async function syncTodosFromSpecs(): Promise<{
  created: number;
  existing: number;
  pages: string[]
}> {
  await mkdir(OUTPUTS_ROOT, { recursive: true });

  const existingTodos = await readTodos();
  const createdTodos: Todo[] = [];
  const pagesWithSpecs: string[] = [];
  let existingCount = 0;

  try {
    // List all page folders
    const entries = await readdir(OUTPUTS_ROOT, { withFileTypes: true });
    const pageFolders = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const pageName of pageFolders) {
      const pagePath = path.join(OUTPUTS_ROOT, pageName);
      const refsPath = path.join(pagePath, "component-refs.json");

      // Read component-refs.json
      const componentRefs = await safeReadJson<ComponentRefsIndex>(refsPath);
      if (!componentRefs?.components) continue;

      const componentIds = Object.keys(componentRefs.components);
      if (componentIds.length > 0) {
        pagesWithSpecs.push(pageName);
      }

      // Create todos for each component
      for (const [compId, compRef] of Object.entries(componentRefs.components)) {
        const elementName = compRef.selectors.elementKey || compId;

        // Check if todo already exists
        const exists = existingTodos.some(
          t => t.pageName === pageName &&
               (t.elementName === elementName || t.contextPath === compRef.contextPath)
        );

        if (exists) {
          existingCount++;
          continue;
        }

        // Generate task prompt
        const taskPrompt = await generateTaskPrompt(
          pageName,
          elementName,
          compRef.contextPath
        );

        // Create new todo
        const newTodo: Todo = {
          id: generateTodoId(),
          title: `Implement ${elementName}`,
          description: `Complete the implementation for "${elementName}" based on its spec`,
          completed: false,
          pageName,
          elementName,
          contextPath: compRef.contextPath,
          taskPrompt,
          createdAt: new Date().toISOString()
        };

        createdTodos.push(newTodo);
      }
    }

    // Save all todos
    if (createdTodos.length > 0) {
      const allTodos = [...existingTodos, ...createdTodos];
      await writeTodos(allTodos);
    }

    return {
      created: createdTodos.length,
      existing: existingCount,
      pages: pagesWithSpecs
    };
  } catch (error) {
    console.error("[todo-actions] Error syncing todos:", error);
    return { created: 0, existing: 0, pages: [] };
  }
}

// ============ Toggle Todo Completion ============

export async function toggleTodoComplete(
  todoId: string
): Promise<{ success: boolean; todo?: Todo }> {
  try {
    const todos = await readTodos();
    const index = todos.findIndex(t => t.id === todoId);

    if (index === -1) {
      return { success: false };
    }

    todos[index].completed = !todos[index].completed;
    todos[index].completedAt = todos[index].completed
      ? new Date().toISOString()
      : undefined;

    await writeTodos(todos);

    return { success: true, todo: todos[index] };
  } catch (error) {
    console.error("[todo-actions] Error toggling todo:", error);
    return { success: false };
  }
}
