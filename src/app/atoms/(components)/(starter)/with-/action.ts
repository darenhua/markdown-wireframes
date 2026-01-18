"use server";

import { readdir, stat } from "fs/promises";
import path from "path";
import type { RouteConfig } from "./types";

const OUTPUTS_DIR = path.join(process.cwd(), "outputs");

export interface OutputFolder {
  name: string;
  path: string;
}

export async function getOutputFolders(): Promise<OutputFolder[]> {
  try {
    const entries = await readdir(OUTPUTS_DIR, { withFileTypes: true });
    const folders: OutputFolder[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // Check if page.tsx exists in this folder
        const pagePath = path.join(OUTPUTS_DIR, entry.name, "page.tsx");
        try {
          await stat(pagePath);
          folders.push({
            name: entry.name,
            path: `/${entry.name}`,
          });
        } catch {
          // No page.tsx in this folder, skip it
        }
      }
    }

    return folders;
  } catch (error) {
    console.error("Error reading outputs folder:", error);
    return [];
  }
}

export async function getOutputRouteConfigs(): Promise<RouteConfig[]> {
  const folders = await getOutputFolders();
  return folders.map((folder) => ({
    name: folder.name,
    path: folder.path,
    content: "",
  }));
}
