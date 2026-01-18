"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  readTodos,
  syncTodosFromSpecs,
  toggleTodoComplete,
  type Todo,
} from "../todo-actions";

interface TodosPanelProps {
  currentPage?: string;
}

export function TodosPanel({ currentPage }: TodosPanelProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [filterCurrentPage, setFilterCurrentPage] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Fetch todos
  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await readTodos();
      setTodos(data);
    } catch (error) {
      console.error("Failed to fetch todos:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Sync from specs
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncTodosFromSpecs();
      console.log("Sync result:", result);
      await fetchTodos();
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Toggle completion
  const handleToggleComplete = async (todoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await toggleTodoComplete(todoId);
    if (result.success && result.todo) {
      setTodos(prev =>
        prev.map(t => (t.id === todoId ? result.todo! : t))
      );
    }
  };

  // Copy task prompt
  const handleCopyPrompt = async (todo: Todo) => {
    if (!todo.taskPrompt) return;

    try {
      await navigator.clipboard.writeText(todo.taskPrompt);
      setCopiedId(todo.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  // Filter todos
  const filteredTodos = todos.filter(todo => {
    if (hideCompleted && todo.completed) return false;
    if (filterCurrentPage && currentPage && todo.pageName !== currentPage) return false;
    return true;
  });

  // Stats
  const completedCount = todos.filter(t => t.completed).length;
  const pendingCount = todos.filter(t => !t.completed).length;

  // Empty state
  if (!isLoading && todos.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-center p-4">
        <p className="text-xs font-medium mb-1">No tasks yet</p>
        <p className="text-[10px] text-muted-foreground mb-3 max-w-[180px]">
          Sync from your component specs to create implementation tasks
        </p>
        <Button
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="text-xs h-7"
        >
          {isSyncing ? "Syncing..." : "Sync from Specs"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 pb-2 border-b">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium">Tasks</span>
            <span className="text-[9px] text-muted-foreground">
              ({pendingCount} pending)
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-6 px-2 text-[10px]"
          >
            {isSyncing ? "..." : "Sync"}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <Checkbox
              checked={hideCompleted}
              onCheckedChange={(checked) => setHideCompleted(checked === true)}
              className="size-3"
            />
            Hide done
          </label>
          {currentPage && (
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <Checkbox
                checked={filterCurrentPage}
                onCheckedChange={(checked) => setFilterCurrentPage(checked === true)}
                className="size-3"
              />
              This page only
            </label>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">Loading...</span>
        </div>
      ) : filteredTodos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <p className="text-[10px] text-muted-foreground">
            No tasks match filters
          </p>
        </div>
      ) : (
        /* Todo List */
        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="py-2 space-y-1.5">
            {filteredTodos.map((todo) => (
              <div
                key={todo.id}
                onClick={() => handleCopyPrompt(todo)}
                onMouseEnter={() => setHoveredId(todo.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={cn(
                  "group relative rounded-lg border p-2 cursor-pointer transition-all",
                  "hover:border-purple-300 hover:bg-purple-50/50",
                  todo.completed && "opacity-60",
                  hoveredId === todo.id && "border-purple-300 bg-purple-50/50"
                )}
              >
                {/* Top row: checkbox + title */}
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={todo.completed}
                    onCheckedChange={() => {}}
                    onClick={(e) => handleToggleComplete(todo.id, e)}
                    className="mt-0.5 size-3"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-[11px] font-medium leading-tight",
                      todo.completed && "line-through text-muted-foreground"
                    )}>
                      {todo.title}
                    </p>
                    {/* Page and element info */}
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {todo.pageName}
                      {todo.elementName && ` · ${todo.elementName}`}
                    </p>
                  </div>

                  {/* Copy indicator */}
                  <div className={cn(
                    "shrink-0 transition-opacity text-[9px]",
                    hoveredId === todo.id || copiedId === todo.id
                      ? "opacity-100"
                      : "opacity-0"
                  )}>
                    {copiedId === todo.id ? (
                      <span className="text-green-600">Copied!</span>
                    ) : (
                      <span className="text-muted-foreground">Click to copy</span>
                    )}
                  </div>
                </div>

                {/* No prompt warning */}
                {!todo.taskPrompt && (
                  <p className="text-[9px] text-amber-600 mt-1 ml-5">
                    No prompt available
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Footer stats */}
      {!isLoading && todos.length > 0 && (
        <div className="shrink-0 pt-2 border-t">
          <div className="flex items-center justify-between text-[9px] text-muted-foreground">
            <span>{completedCount} completed</span>
            <span>{todos.length} total</span>
          </div>
        </div>
      )}
    </div>
  );
}
