"use server";

import { writeFile, readdir } from "fs/promises";
import path from "path";
import type { ActionResult, AddRouteFormData } from "./types";

const PAGES_DIR = path.join(
  process.cwd(),
  "src/app/atoms/(components)/(starter)/react-router/pages"
);

export async function addRoute(formData: AddRouteFormData): Promise<ActionResult> {
  try {
    const { name, path: routePath, content } = formData;

    // Sanitize the filename
    const fileName = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (!fileName) {
      return { success: false, message: "Invalid route name" };
    }

    const filePath = path.join(PAGES_DIR, `${fileName}.tsx`);

    // Create the component content
    const componentName = name
      .split(/[\s-]+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");

    const fileContent = `export default function ${componentName}Page() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-4">${name}</h1>
      <div className="p-4 bg-gray-800 rounded-lg">
        <div className="text-gray-300 whitespace-pre-wrap">${content.replace(/`/g, "\\`").replace(/\$/g, "\\$")}</div>
      </div>
    </div>
  );
}
`;

    await writeFile(filePath, fileContent, "utf-8");

    return {
      success: true,
      message: `Route "${name}" created successfully`,
      route: {
        name,
        path: routePath.startsWith("/") ? routePath : `/${routePath}`,
        content,
      },
    };
  } catch (error) {
    console.error("Error adding route:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to add route",
    };
  }
}

export async function getExistingRoutes(): Promise<string[]> {
  try {
    const files = await readdir(PAGES_DIR);
    return files
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => f.replace(".tsx", ""));
  } catch {
    return [];
  }
}
