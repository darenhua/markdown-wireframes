import { Button } from "@/components/ui/button";

export default function HelloWorldPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Hello World</h1>
      <p className="text-muted-foreground">
        A simple atom component demonstrating the directory structure.
      </p>
      <Button>Click me</Button>
    </div>
  );
}
