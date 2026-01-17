"use server";

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Todo = {
  id: string;
  text: string;
  createdAt: string;
};

const TODO_FILE = join(process.cwd(), "todo.json");

async function readTodos(): Promise<Todo[]> {
  try {
    const data = await readFile(TODO_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeTodos(todos: Todo[]): Promise<void> {
  await writeFile(TODO_FILE, JSON.stringify(todos, null, 2));
}

export async function getTodos(): Promise<Todo[]> {
  return readTodos();
}

export async function createTodo(text: string): Promise<Todo> {
  const todos = await readTodos();
  const newTodo: Todo = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
  };
  todos.push(newTodo);
  await writeTodos(todos);
  return newTodo;
}

export async function deleteTodo(id: string): Promise<void> {
  const todos = await readTodos();
  const filtered = todos.filter((todo) => todo.id !== id);
  await writeTodos(filtered);
}

type ComponentItem = { name: string; title: string };

export type Group = {
  id: string;
  title: string;
  atoms: ComponentItem[];
  molecules: ComponentItem[];
};

function toTitleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function getComponentsInGroup(
  basePath: string,
  groupFolder: string
): Promise<string[]> {
  const groupPath = join(basePath, `(${groupFolder})`);
  try {
    const entries = await readdir(groupPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("("))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function getGroups(): Promise<Group[]> {
  const atomsBase = join(process.cwd(), "src/app/atoms/(components)");
  const moleculesBase = join(process.cwd(), "src/app/molecules/(components)");

  const atomEntries = await readdir(atomsBase, { withFileTypes: true });

  const groupFolders = atomEntries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name.startsWith("(") &&
        entry.name.endsWith(")")
    )
    .map((entry) => entry.name.slice(1, -1));

  const groups: Group[] = await Promise.all(
    groupFolders.map(async (groupFolder) => {
      const atomNames = await getComponentsInGroup(atomsBase, groupFolder);
      const moleculeNames = await getComponentsInGroup(
        moleculesBase,
        groupFolder
      );

      return {
        id: groupFolder,
        title: toTitleCase(groupFolder),
        atoms: atomNames.map((name) => ({ name, title: toTitleCase(name) })),
        molecules: moleculeNames.map((name) => ({
          name,
          title: toTitleCase(name),
        })),
      };
    })
  );

  return groups;
}
