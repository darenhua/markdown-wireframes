"use client";

import { FileText, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error?: Error & { digest?: string };
  reset?: () => void;
  folderName?: string;
}

export default function ErrorPage({ error, reset, folderName }: ErrorPageProps) {
  // If there's no actual error, show empty state
  const isEmptyState = !error;

  if (isEmptyState) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-muted/50">
          <FileText className="size-8 text-muted-foreground/60" />
        </div>
        <p className="text-lg font-medium text-muted-foreground">Empty Page</p>
        <p className="mt-2 max-w-[280px] text-sm text-muted-foreground/70">
          {folderName
            ? `This page (${folderName}) doesn't have any content yet.`
            : "This page doesn't have any content yet."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground/50">
          Use the Tools panel to generate UI for this page.
        </p>
      </div>
    );
  }

  // Show error state with retry option
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertCircle className="size-8 text-destructive/60" />
      </div>
      <p className="text-lg font-medium text-destructive">Something went wrong</p>
      <p className="mt-2 max-w-[320px] text-sm text-muted-foreground">
        {error.message || "Failed to load this page. Please try again."}
      </p>
      {reset && (
        <Button
          onClick={reset}
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
        >
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      )}
      {error.digest && (
        <p className="mt-3 text-xs text-muted-foreground/50">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}

// Export the empty state component separately for use in dynamic imports
export function EmptyPageState({ folderName }: { folderName: string }) {
  return <ErrorPage folderName={folderName} />;
}
