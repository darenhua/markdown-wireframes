import { Tool, Resource, SchemaConstraint, Optional } from "@leanmcp/core";
import * as fs from "fs/promises";
import * as path from "path";
import { OUTPUTS_PATH } from "../../config.js";

// ============================================
// Types
// ============================================

interface Todo {
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

// ============================================
// Input Classes
// ============================================

class CreateTodoInput {
  @SchemaConstraint({
    description: "Title of the todo item",
    minLength: 1
  })
  title!: string;

  @Optional()
  @SchemaConstraint({
    description: "Optional description with more details"
  })
  description?: string;

  @SchemaConstraint({
    description: "Name of the page this todo belongs to"
  })
  pageName!: string;

  @Optional()
  @SchemaConstraint({
    description: "Optional element/component name this todo is for"
  })
  elementName?: string;
}

class UpdateTodoInput {
  @SchemaConstraint({
    description: "ID of the todo to update"
  })
  todoId!: string;

  @SchemaConstraint({
    description: "New completion status"
  })
  completed!: boolean;
}

class DeleteTodoInput {
  @SchemaConstraint({
    description: "ID of the todo to delete"
  })
  todoId!: string;
}

class ListTodosInput {
  @Optional()
  @SchemaConstraint({
    description: "Filter by page name"
  })
  pageName?: string;

  @Optional()
  @SchemaConstraint({
    description: "Filter by completion status"
  })
  completed?: boolean;
}

class SyncTodosInput {
  @SchemaConstraint({
    description: "Page name to sync todos for (creates todos from context files)"
  })
  pageName!: string;
}

// ============================================
// Helper Functions
// ============================================

function getOutputsPath(): string {
  return OUTPUTS_PATH;
}

function getTodosFilePath(): string {
  return path.join(getOutputsPath(), "todos.json");
}

async function readTodosFile(): Promise<TodosData> {
  const filePath = getTodosFilePath();
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    // Return empty todos if file doesn't exist
    return {
      todos: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

async function writeTodosFile(data: TodosData): Promise<void> {
  const filePath = getTodosFilePath();
  data.lastUpdated = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function generateTodoId(): string {
  return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

async function generateTaskPrompt(
  pageName: string,
  elementName: string,
  contextPath: string
): Promise<string> {
  const outputsPath = getOutputsPath();
  const pagePath = path.join(outputsPath, pageName);

  // Read the page TSX
  const pageTsx = await safeReadFile(path.join(pagePath, "page.tsx"));

  // Read the context/spec file
  const contextMd = await safeReadFile(path.join(pagePath, contextPath));

  // Read the tree.json to understand structure
  const treeJson = await safeReadJson(path.join(pagePath, "tree.json"));

  // Read component-refs.json if it exists to understand component relationships
  const componentRefs = await safeReadJson(path.join(pagePath, "component-refs.json"));

  // Build the prompt
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

async function findContextFiles(basePath: string): Promise<Array<{elementName: string; contextPath: string}>> {
  const results: Array<{elementName: string; contextPath: string}> = [];

  // Check for spec-index.json which maps element names to context paths
  const specIndexPath = path.join(basePath, "spec-index.json");
  try {
    const specContent = await fs.readFile(specIndexPath, "utf-8");
    const specIndex = JSON.parse(specContent);

    if (specIndex.elements) {
      for (const [elementName, data] of Object.entries(specIndex.elements)) {
        const elementData = data as { contextPath?: string };
        if (elementData.contextPath) {
          results.push({
            elementName,
            contextPath: elementData.contextPath
          });
        }
      }
    }
    return results;
  } catch {
    // Fallback: scan for context.md files
  }

  // Scan components directory for context.md files
  const componentsPath = path.join(basePath, "components");
  try {
    const entries = await fs.readdir(componentsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const contextPath = path.join("components", entry.name, "context.md");
        const fullContextPath = path.join(basePath, contextPath);

        if (await fileExists(fullContextPath)) {
          results.push({
            elementName: entry.name,
            contextPath
          });
        }
      }
    }
  } catch {
    // Components directory doesn't exist
  }

  return results;
}

// ============================================
// Service Class
// ============================================

export class TodoService {

  @Tool({
    description: "List all todos with optional filtering by page or completion status",
    inputClass: ListTodosInput
  })
  async listTodos(input: ListTodosInput) {
    const data = await readTodosFile();

    let todos = data.todos;

    // Apply filters
    if (input.pageName) {
      todos = todos.filter(t => t.pageName === input.pageName);
    }

    if (input.completed !== undefined) {
      todos = todos.filter(t => t.completed === input.completed);
    }

    const stats = {
      total: todos.length,
      completed: todos.filter(t => t.completed).length,
      pending: todos.filter(t => !t.completed).length
    };

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          todos,
          stats,
          lastUpdated: data.lastUpdated
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Create a new todo item linked to a page and optionally an element/component",
    inputClass: CreateTodoInput
  })
  async createTodo(input: CreateTodoInput) {
    const data = await readTodosFile();
    const outputsPath = getOutputsPath();

    // Determine context path if element is specified
    let contextPath: string | undefined;
    if (input.elementName) {
      const pagePath = path.join(outputsPath, input.pageName);
      const contextFiles = await findContextFiles(pagePath);
      const found = contextFiles.find(c => c.elementName === input.elementName);
      if (found) {
        contextPath = found.contextPath;
      }
    }

    // Generate task prompt if we have element and context
    let taskPrompt: string | undefined;
    if (input.elementName && contextPath) {
      taskPrompt = await generateTaskPrompt(input.pageName, input.elementName, contextPath);
    }

    const newTodo: Todo = {
      id: generateTodoId(),
      title: input.title,
      description: input.description,
      completed: false,
      pageName: input.pageName,
      elementName: input.elementName,
      contextPath,
      taskPrompt,
      createdAt: new Date().toISOString()
    };

    data.todos.push(newTodo);
    await writeTodosFile(data);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          message: "Todo created successfully",
          todo: newTodo
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Mark a todo as completed or not completed",
    inputClass: UpdateTodoInput
  })
  async updateTodoStatus(input: UpdateTodoInput) {
    const data = await readTodosFile();

    const todoIndex = data.todos.findIndex(t => t.id === input.todoId);

    if (todoIndex === -1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `Todo not found with id: ${input.todoId}`
          }, null, 2)
        }]
      };
    }

    data.todos[todoIndex].completed = input.completed;

    if (input.completed) {
      data.todos[todoIndex].completedAt = new Date().toISOString();
    } else {
      delete data.todos[todoIndex].completedAt;
    }

    await writeTodosFile(data);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          message: `Todo ${input.completed ? "completed" : "marked as pending"}`,
          todo: data.todos[todoIndex]
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Delete a todo item",
    inputClass: DeleteTodoInput
  })
  async deleteTodo(input: DeleteTodoInput) {
    const data = await readTodosFile();

    const todoIndex = data.todos.findIndex(t => t.id === input.todoId);

    if (todoIndex === -1) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `Todo not found with id: ${input.todoId}`
          }, null, 2)
        }]
      };
    }

    const deletedTodo = data.todos.splice(todoIndex, 1)[0];
    await writeTodosFile(data);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          message: "Todo deleted successfully",
          deletedTodo
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Sync todos with context files for a page - creates todos for any context files that don't have corresponding todos",
    inputClass: SyncTodosInput
  })
  async syncTodosFromContext(input: SyncTodosInput) {
    const data = await readTodosFile();
    const outputsPath = getOutputsPath();
    const pagePath = path.join(outputsPath, input.pageName);

    // Check if page exists
    if (!await fileExists(pagePath)) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            error: `Page not found: ${input.pageName}`
          }, null, 2)
        }]
      };
    }

    // Find all context files for this page
    const contextFiles = await findContextFiles(pagePath);

    const created: Todo[] = [];
    const existing: string[] = [];

    for (const { elementName, contextPath } of contextFiles) {
      // Check if a todo already exists for this element
      const existingTodo = data.todos.find(
        t => t.pageName === input.pageName && t.elementName === elementName
      );

      if (existingTodo) {
        existing.push(elementName);
      } else {
        // Generate task prompt
        const taskPrompt = await generateTaskPrompt(input.pageName, elementName, contextPath);

        // Create new todo for this context
        const newTodo: Todo = {
          id: generateTodoId(),
          title: `Implement ${elementName}`,
          description: `Complete the implementation for element "${elementName}" based on its context/spec`,
          completed: false,
          pageName: input.pageName,
          elementName,
          contextPath,
          taskPrompt,
          createdAt: new Date().toISOString()
        };

        data.todos.push(newTodo);
        created.push(newTodo);
      }
    }

    await writeTodosFile(data);

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          message: `Synced todos for page: ${input.pageName}`,
          created,
          existingElements: existing,
          stats: {
            newTodosCreated: created.length,
            existingTodos: existing.length,
            totalContextFiles: contextFiles.length
          }
        }, null, 2)
      }]
    };
  }

  @Tool({
    description: "Get summary statistics for all todos",
    inputClass: class {}
  })
  async getTodoStats() {
    const data = await readTodosFile();

    // Group by page
    const byPage: Record<string, { total: number; completed: number; pending: number }> = {};

    for (const todo of data.todos) {
      if (!byPage[todo.pageName]) {
        byPage[todo.pageName] = { total: 0, completed: 0, pending: 0 };
      }
      byPage[todo.pageName].total++;
      if (todo.completed) {
        byPage[todo.pageName].completed++;
      } else {
        byPage[todo.pageName].pending++;
      }
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          overall: {
            total: data.todos.length,
            completed: data.todos.filter(t => t.completed).length,
            pending: data.todos.filter(t => !t.completed).length
          },
          byPage,
          lastUpdated: data.lastUpdated
        }, null, 2)
      }]
    };
  }

  @Resource({
    description: "Get todo service configuration and file path"
  })
  async todoConfig() {
    const todosPath = path.join(OUTPUTS_PATH, "todos.json");

    return {
      contents: [{
        uri: "todos://config",
        mimeType: "application/json",
        text: JSON.stringify({
          name: "todo-service",
          version: "1.0.0",
          outputsPath: OUTPUTS_PATH,
          todosFilePath: todosPath,
          configured: true
        }, null, 2)
      }]
    };
  }
}
