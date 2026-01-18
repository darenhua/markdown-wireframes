"use server";

import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { randomBytes } from "crypto";

const OUTPUTS_ROOT = path.join(process.cwd(), "outputs");

// Types
export interface SelectorInfo {
  elementKey?: string;
  tagName?: string;
  className?: string;
  textContent?: string;
  id?: string;
}

export interface ComponentRef {
  id: string;
  selectors: SelectorInfo;
  contextPath: string;
  createdAt: string;
  lastUpdated: string;
}

export interface ComponentRefsIndex {
  components: Record<string, ComponentRef>;
}

// Legacy type for backwards compatibility
export interface SpecIndex {
  elements: Record<
    string,
    {
      hasSpec: boolean;
      lastUpdated: string;
      contextPath: string;
    }
  >;
}

export interface ElementInfo {
  key: string;
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

// Generate a unique component ID
function generateComponentId(): string {
  return `comp-${randomBytes(6).toString("hex")}`;
}

// Read component-refs.json for a page
export async function readComponentRefs(pageName: string): Promise<ComponentRefsIndex> {
  const refsPath = path.join(OUTPUTS_ROOT, pageName, "component-refs.json");
  try {
    if (!existsSync(refsPath)) return { components: {} };
    const content = await readFile(refsPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { components: {} };
  }
}

// Write component-refs.json for a page
async function writeComponentRefs(pageName: string, refs: ComponentRefsIndex): Promise<void> {
  const pageDir = path.join(OUTPUTS_ROOT, pageName);
  const refsPath = path.join(pageDir, "component-refs.json");
  await mkdir(pageDir, { recursive: true });
  await writeFile(refsPath, JSON.stringify(refs, null, 2), "utf-8");
}

// Find existing component ref by selectors
export async function findComponentBySelectors(
  pageName: string,
  selectors: SelectorInfo
): Promise<ComponentRef | null> {
  const refs = await readComponentRefs(pageName);

  for (const comp of Object.values(refs.components)) {
    // Match by elementKey first (most reliable)
    if (selectors.elementKey && comp.selectors.elementKey === selectors.elementKey) {
      return comp;
    }
    // Fallback: match by combination of tagName + textContent
    if (
      selectors.tagName &&
      selectors.textContent &&
      comp.selectors.tagName === selectors.tagName &&
      comp.selectors.textContent === selectors.textContent
    ) {
      return comp;
    }
  }

  return null;
}

// Get or create a component ref for the given selectors
export async function getOrCreateComponentRef(
  pageName: string,
  selectors: SelectorInfo
): Promise<ComponentRef> {
  // Try to find existing
  const existing = await findComponentBySelectors(pageName, selectors);
  if (existing) {
    return existing;
  }

  // Create new
  const id = generateComponentId();
  const now = new Date().toISOString();
  const newRef: ComponentRef = {
    id,
    selectors,
    contextPath: `components/${id}/context.md`,
    createdAt: now,
    lastUpdated: now,
  };

  // Save to refs index
  const refs = await readComponentRefs(pageName);
  refs.components[id] = newRef;
  await writeComponentRefs(pageName, refs);

  return newRef;
}

// Read context.md for a specific component
export async function readElementContext(
  pageName: string,
  elementKey: string
): Promise<string> {
  // First try to find by selectors in new system
  const componentRef = await findComponentBySelectors(pageName, { elementKey });

  if (componentRef) {
    const contextPath = path.join(OUTPUTS_ROOT, pageName, componentRef.contextPath);
    try {
      if (existsSync(contextPath)) {
        return await readFile(contextPath, "utf-8");
      }
    } catch {
      // Fall through to legacy
    }
  }

  // Legacy fallback: old path structure
  const legacyPath = path.join(OUTPUTS_ROOT, pageName, elementKey, "context.md");
  try {
    if (!existsSync(legacyPath)) return "";
    return await readFile(legacyPath, "utf-8");
  } catch {
    return "";
  }
}

// Write context.md for a specific element (uses new component ref system)
export async function writeElementContext(
  pageName: string,
  elementKey: string,
  content: string,
  selectors?: SelectorInfo
): Promise<{ success: boolean; componentId?: string }> {
  const selectorInfo: SelectorInfo = selectors || { elementKey };

  console.log("[spec-actions] writeElementContext:", { pageName, elementKey, selectors: selectorInfo });

  try {
    // Get or create component ref
    const componentRef = await getOrCreateComponentRef(pageName, selectorInfo);

    // Build the component directory path
    const componentDir = path.join(OUTPUTS_ROOT, pageName, "components", componentRef.id);
    const contextPath = path.join(componentDir, "context.md");

    // Write the context file
    await mkdir(componentDir, { recursive: true });
    await writeFile(contextPath, content, "utf-8");
    console.log("[spec-actions] Wrote context.md to:", contextPath);

    // Update the lastUpdated timestamp in refs
    const refs = await readComponentRefs(pageName);
    if (refs.components[componentRef.id]) {
      refs.components[componentRef.id].lastUpdated = new Date().toISOString();
      await writeComponentRefs(pageName, refs);
    }

    // Also update legacy spec-index for backwards compatibility
    await updateSpecIndex(pageName, elementKey, true, componentRef.contextPath);

    return { success: true, componentId: componentRef.id };
  } catch (error) {
    console.error("[spec-actions] Error writing context:", error);
    return { success: false };
  }
}

// Read spec-index.json for a page (legacy, kept for backwards compatibility)
export async function readSpecIndex(pageName: string): Promise<SpecIndex> {
  const indexPath = path.join(OUTPUTS_ROOT, pageName, "spec-index.json");
  try {
    if (!existsSync(indexPath)) return { elements: {} };
    const content = await readFile(indexPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return { elements: {} };
  }
}

// Update spec-index.json when context is written (legacy compatibility)
async function updateSpecIndex(
  pageName: string,
  elementKey: string,
  hasSpec: boolean,
  contextPath?: string
): Promise<void> {
  const indexPath = path.join(OUTPUTS_ROOT, pageName, "spec-index.json");
  const pageDir = path.join(OUTPUTS_ROOT, pageName);

  let index: SpecIndex = { elements: {} };
  try {
    if (existsSync(indexPath)) {
      const content = await readFile(indexPath, "utf-8");
      index = JSON.parse(content);
    }
  } catch {
    // Start fresh if parsing fails
  }

  index.elements[elementKey] = {
    hasSpec,
    lastUpdated: new Date().toISOString(),
    contextPath: contextPath || `components/${elementKey}/context.md`,
  };

  await mkdir(pageDir, { recursive: true });
  await writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");
}

// Context template with all sections (not exported - "use server" files can only export async functions)
const CONTEXT_TEMPLATE = `# Component Spec: {elementKey}

## Overview
[Brief description of this component]

## Purpose (Why)
- **User Need**: [What user need does this address?]
- **Problem Solved**: [What problem does it solve?]
- **Product Vision**: [How does it fit into the larger product?]

## Definition (What)
### Features
- [Key features]

### Behaviors
- [Interaction patterns]

### Constraints
- [Limitations, edge cases]

## Implementation (How)
### Data Requirements
- [Data sources, APIs]

### Interactions
- [Events, handlers]

### Technical Notes
- [Stack considerations]

## Open Questions
- [Unresolved items]
`;

// Parse context to find which sections are filled vs empty/placeholder
export async function analyzeContextCompleteness(content: string): Promise<{
  filled: string[];
  missing: string[];
}> {
  const sections = [
    { name: "Overview", pattern: /## Overview\n([^\n#]+)/ },
    { name: "User Need", pattern: /\*\*User Need\*\*:\s*([^\n]+)/ },
    { name: "Problem Solved", pattern: /\*\*Problem Solved\*\*:\s*([^\n]+)/ },
    { name: "Product Vision", pattern: /\*\*Product Vision\*\*:\s*([^\n]+)/ },
    { name: "Features", pattern: /### Features\n([\s\S]*?)(?=###|## |$)/ },
    { name: "Behaviors", pattern: /### Behaviors\n([\s\S]*?)(?=###|## |$)/ },
    { name: "Constraints", pattern: /### Constraints\n([\s\S]*?)(?=###|## |$)/ },
    { name: "Data Requirements", pattern: /### Data Requirements\n([\s\S]*?)(?=###|## |$)/ },
    { name: "Interactions", pattern: /### Interactions\n([\s\S]*?)(?=###|## |$)/ },
    { name: "Technical Notes", pattern: /### Technical Notes\n([\s\S]*?)(?=###|## |$)/ },
  ];

  const filled: string[] = [];
  const missing: string[] = [];

  for (const section of sections) {
    const match = content.match(section.pattern);
    if (match && match[1]) {
      const value = match[1].trim();
      // Check if it's just a placeholder
      if (value.startsWith("[") && value.endsWith("]")) {
        missing.push(section.name);
      } else if (value.length > 5 && !value.includes("[")) {
        filled.push(section.name);
      } else {
        missing.push(section.name);
      }
    } else {
      missing.push(section.name);
    }
  }

  return { filled, missing };
}

// Create initial context file with template
export async function createInitialContext(
  pageName: string,
  elementKey: string,
  selectors?: SelectorInfo
): Promise<{ success: boolean; componentId?: string; contextPath?: string }> {
  const selectorInfo: SelectorInfo = selectors || { elementKey };

  console.log("[spec-actions] createInitialContext:", { pageName, elementKey, selectors: selectorInfo });

  try {
    // Get or create component ref
    const componentRef = await getOrCreateComponentRef(pageName, selectorInfo);

    // Build the component directory path
    const componentDir = path.join(OUTPUTS_ROOT, pageName, "components", componentRef.id);
    const contextPath = path.join(componentDir, "context.md");

    // Check if context file already exists
    if (existsSync(contextPath)) {
      console.log("[spec-actions] Context file already exists:", contextPath);
      return { success: true, componentId: componentRef.id, contextPath: componentRef.contextPath };
    }

    // Create initial context from template
    const initialContent = CONTEXT_TEMPLATE.replace("{elementKey}", elementKey);

    // Write the context file
    await mkdir(componentDir, { recursive: true });
    await writeFile(contextPath, initialContent, "utf-8");
    console.log("[spec-actions] Created initial context.md at:", contextPath);

    // Update legacy spec-index for backwards compatibility
    await updateSpecIndex(pageName, elementKey, true, componentRef.contextPath);

    return { success: true, componentId: componentRef.id, contextPath: componentRef.contextPath };
  } catch (error) {
    console.error("[spec-actions] Error creating initial context:", error);
    return { success: false };
  }
}

// Get element info from tree.json by key
export async function getElementFromTree(
  pageName: string,
  elementKey: string
): Promise<ElementInfo | null> {
  const treePath = path.join(OUTPUTS_ROOT, pageName, "tree.json");
  try {
    const content = await readFile(treePath, "utf-8");
    const tree = JSON.parse(content);
    const element = tree.elements[elementKey];
    if (!element) return null;
    return {
      key: element.key,
      type: element.type,
      props: element.props || {},
      children: element.children,
    };
  } catch {
    return null;
  }
}

// Get full tree.json content
export async function getTreeJson(
  pageName: string
): Promise<{ root: string; elements: Record<string, ElementInfo> } | null> {
  const treePath = path.join(OUTPUTS_ROOT, pageName, "tree.json");
  console.log("[spec-actions] Reading tree from:", treePath);
  try {
    const exists = existsSync(treePath);
    console.log("[spec-actions] File exists:", exists);
    if (!exists) return null;
    const content = await readFile(treePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("[spec-actions] Error reading tree:", error);
    return null;
  }
}

// Spec summary for listing
export interface SpecSummary {
  componentId: string;
  elementKey?: string;
  contextPath: string;
  content: string;
  createdAt: string;
  lastUpdated: string;
  selectors: SelectorInfo;
}

// Get all specs for a page with their content
export async function getAllSpecsForPage(pageName: string): Promise<SpecSummary[]> {
  const specs: SpecSummary[] = [];

  try {
    const refs = await readComponentRefs(pageName);

    for (const [componentId, ref] of Object.entries(refs.components)) {
      const contextPath = path.join(OUTPUTS_ROOT, pageName, ref.contextPath);
      let content = "";

      try {
        if (existsSync(contextPath)) {
          content = await readFile(contextPath, "utf-8");
        }
      } catch {
        // Skip if can't read
      }

      specs.push({
        componentId,
        elementKey: ref.selectors.elementKey,
        contextPath: ref.contextPath,
        content,
        createdAt: ref.createdAt,
        lastUpdated: ref.lastUpdated,
        selectors: ref.selectors,
      });
    }

    // Sort by lastUpdated descending
    specs.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());

  } catch (error) {
    console.error("[spec-actions] Error getting all specs:", error);
  }

  return specs;
}

// Generate a task prompt for implementing a spec (reads current page.tsx)
export async function generateSpecTaskPrompt(
  pageName: string,
  componentId: string,
  elementName: string,
  specContent: string
): Promise<string> {
  const pagePath = path.join(OUTPUTS_ROOT, pageName);

  // Read current page.tsx
  let pageTsx = "// Page file not found";
  try {
    const pageTsxPath = path.join(pagePath, "page.tsx");
    if (existsSync(pageTsxPath)) {
      pageTsx = await readFile(pageTsxPath, "utf-8");
    }
  } catch {
    // Use fallback
  }

  // Read tree.json
  let treeJson = null;
  try {
    const treePath = path.join(pagePath, "tree.json");
    if (existsSync(treePath)) {
      const content = await readFile(treePath, "utf-8");
      treeJson = JSON.parse(content);
    }
  } catch {
    // Skip
  }

  // Read component-refs.json
  const componentRefs = await readComponentRefs(pageName);

  const prompt = `# Task: Implement "${elementName}" Component

## Page Context
You are building a component for the page "${pageName}".

### Current Page TSX
\`\`\`tsx
${pageTsx}
\`\`\`

### Component Specification
${specContent || "// No spec content found"}

### UI Tree Structure
\`\`\`json
${treeJson ? JSON.stringify(treeJson, null, 2) : "// Tree file not found"}
\`\`\`

### Component References
\`\`\`json
${JSON.stringify(componentRefs, null, 2)}
\`\`\`

## Instructions
1. Review the component specification above to understand the requirements
2. Look at the page TSX to see how this component fits into the overall page
3. Use the UI tree structure to understand the component hierarchy
4. Implement the "${elementName}" component according to the spec
5. Ensure the component integrates properly with the existing page structure

Please implement this component following the specification and ensuring it works within the page context.`;

  return prompt;
}
