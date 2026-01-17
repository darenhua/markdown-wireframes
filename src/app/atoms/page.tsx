"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type Group,
  type Todo,
  createTodo,
  deleteTodo,
  getGroups,
  getTodos,
} from "./actions";

export default function AtomsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoText, setNewTodoText] = useState("");

  useEffect(() => {
    getGroups().then(setGroups);
    getTodos().then(setTodos);
  }, []);

  async function handleCreateTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTodoText.trim()) return;
    const todo = await createTodo(newTodoText.trim());
    setTodos((prev) => [...prev, todo]);
    setNewTodoText("");
  }

  async function handleDeleteTodo(id: string) {
    await deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  const currentGroupId = searchParams.get("group") || groups[0]?.id || "";

  function handleTabChange(value: string) {
    router.push(`/atoms?group=${value}`);
  }

  if (groups.length === 0) {
    return (
      <div className="p-6">
        <h1 className="mb-6 font-bold text-3xl">Components</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 font-bold text-3xl">Components</h1>

      <section className="mb-8 rounded-lg border bg-muted/30 p-4">
        <h2 className="mb-4 font-semibold text-lg">Todo List</h2>
        <form className="mb-4 flex gap-2" onSubmit={handleCreateTodo}>
          <Input
            className="flex-1"
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Add a new todo..."
            value={newTodoText}
          />
          <Button type="submit">Add</Button>
        </form>
        {todos.length > 0 ? (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li
                className="flex items-center justify-between rounded-md border bg-background p-2"
                key={todo.id}
              >
                <span className="text-sm">{todo.text}</span>
                <Button
                  onClick={() => handleDeleteTodo(todo.id)}
                  size="sm"
                  variant="ghost"
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No todos yet</p>
        )}
      </section>

      <Tabs
        className="w-full"
        onValueChange={handleTabChange}
        value={currentGroupId}
      >
        <TabsList className="w-full rounded-b-none">
          {groups.map((group) => (
            <TabsTrigger className="flex-1" key={group.id} value={group.id}>
              {group.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((group) => (
          <TabsContent
            className="mt-0 rounded-t-none rounded-b-lg border border-t-0 bg-muted/30 p-6"
            key={group.id}
            value={group.id}
          >
            <section className="mb-8">
              <h2 className="mb-4 font-semibold text-xl">Atoms</h2>
              {group.atoms.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {group.atoms.map((atom) => (
                    <Link
                      className="block rounded-md border bg-background p-3 transition-colors hover:bg-accent"
                      href={`/atoms/${atom.name}`}
                      key={atom.name}
                    >
                      <span className="font-medium text-sm">{atom.title}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No atoms yet</p>
              )}
            </section>

            <section>
              <h2 className="mb-4 font-semibold text-xl">Molecules</h2>
              {group.molecules.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {group.molecules.map((molecule) => (
                    <Link
                      className="block rounded-md border bg-background p-3 transition-colors hover:bg-accent"
                      href={`/molecules/${molecule.name}`}
                      key={molecule.name}
                    >
                      <span className="font-medium text-sm">
                        {molecule.title}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No molecules yet
                </p>
              )}
            </section>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
