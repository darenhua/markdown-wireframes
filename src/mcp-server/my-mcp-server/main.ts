import { createHTTPServer } from "@leanmcp/core";

// Services are automatically discovered from ./mcp directory
await createHTTPServer({
  name: "my-mcp-server",
  version: "1.0.0",
  port: 3001,
  cors: true,
  logging: true
});

console.log("\nmy-mcp-server MCP Server");
