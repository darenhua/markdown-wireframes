"use server";

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const CONTEXT_DIR = join(process.cwd(), "data", "rachel-v1");
const CONTEXT_FILE = join(CONTEXT_DIR, "context.md");

export async function readContext(): Promise<string> {
  try {
    if (!existsSync(CONTEXT_FILE)) {
      return "";
    }
    const content = await readFile(CONTEXT_FILE, "utf-8");
    return content;
  } catch (error) {
    console.error("Error reading context:", error);
    return "";
  }
}

export async function writeContext(content: string): Promise<{ success: boolean }> {
  try {
    // Ensure directory exists
    if (!existsSync(CONTEXT_DIR)) {
      await mkdir(CONTEXT_DIR, { recursive: true });
    }
    await writeFile(CONTEXT_FILE, content, "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Error writing context:", error);
    return { success: false };
  }
}
