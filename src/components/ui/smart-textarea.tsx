"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { HugeiconsIcon } from "@hugeicons/react";
import { Folder01Icon, File01Icon } from "@hugeicons/core-free-icons";
import type { FileEntry } from "@/app/atoms/(starter)/prompt-setting/actions";

// Marker for file references in the raw value
const FILE_REF_START = "\u200B\u200C"; // Zero-width space + zero-width non-joiner
const FILE_REF_END = "\u200C\u200B";

interface SmartTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  searchFiles: (query: string) => Promise<FileEntry[]>;
  projectRoot: string;
}

// Create a file chip element
function createFileChip(filePath: string, relativePath: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.filePath = filePath;
  chip.className =
    "inline-flex items-center gap-1 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-violet-300 mx-0.5 select-none cursor-default align-baseline";
  chip.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg><span class="text-xs">@${relativePath}</span>`;
  return chip;
}

// Parse value string to extract file references
function parseValueToHtml(value: string, projectRoot: string): string {
  if (!value) return "";

  let result = "";
  let i = 0;

  while (i < value.length) {
    const startIdx = value.indexOf(FILE_REF_START, i);

    if (startIdx === -1) {
      // No more file refs, add remaining text
      result += escapeHtml(value.slice(i));
      break;
    }

    // Add text before the file ref
    result += escapeHtml(value.slice(i, startIdx));

    // Find the end of the file ref
    const endIdx = value.indexOf(FILE_REF_END, startIdx + FILE_REF_START.length);
    if (endIdx === -1) {
      // Malformed, treat rest as text
      result += escapeHtml(value.slice(startIdx));
      break;
    }

    // Extract the file path
    const filePath = value.slice(startIdx + FILE_REF_START.length, endIdx);
    const relativePath = filePath.startsWith(projectRoot)
      ? filePath.slice(projectRoot.length + 1)
      : filePath;

    // Add the chip HTML
    result += `<span contenteditable="false" data-file-path="${escapeHtml(filePath)}" class="inline-flex items-center gap-1 rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-violet-300 mx-0.5 select-none cursor-default align-baseline"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="inline-block"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg><span class="text-xs">@${escapeHtml(relativePath)}</span></span>`;

    i = endIdx + FILE_REF_END.length;
  }

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

// Extract value from DOM
function domToValue(element: HTMLElement): string {
  let result = "";

  function processNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      if (el.tagName === "BR") {
        result += "\n";
      } else if (el.dataset.filePath) {
        // It's a file chip
        result += FILE_REF_START + el.dataset.filePath + FILE_REF_END;
      } else {
        // Process children
        el.childNodes.forEach(processNode);
        // Add newline after block elements
        if (el.tagName === "DIV" && el.nextSibling) {
          result += "\n";
        }
      }
    }
  }

  element.childNodes.forEach(processNode);
  return result;
}

export function SmartTextarea({
  value,
  onChange,
  placeholder = "Type your prompt here... Use @ to reference files",
  className,
  searchFiles,
  projectRoot,
}: SmartTextareaProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const isInitializedRef = useRef(false);
  const lastValueRef = useRef(value);

  // Initialize editor content only once
  useEffect(() => {
    if (editorRef.current && !isInitializedRef.current) {
      editorRef.current.innerHTML = parseValueToHtml(value, projectRoot);
      isInitializedRef.current = true;
      lastValueRef.current = value;
    }
  }, [value, projectRoot]);

  // Update editor if value changes externally (not from user input)
  useEffect(() => {
    if (editorRef.current && isInitializedRef.current && value !== lastValueRef.current) {
      // Save cursor position
      const selection = window.getSelection();
      const hadFocus = document.activeElement === editorRef.current;

      editorRef.current.innerHTML = parseValueToHtml(value, projectRoot);
      lastValueRef.current = value;

      // Restore focus at end if it was focused
      if (hadFocus && selection) {
        const range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }, [value, projectRoot]);

  // Debounced file search
  useEffect(() => {
    if (!showPopover) return;

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchFiles(searchQuery);
        setFiles(results);
      } catch (error) {
        console.error("Search failed:", error);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery, showPopover, searchFiles]);

  // Handle input events - extract value from DOM
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    const newValue = domToValue(editorRef.current);
    lastValueRef.current = newValue;
    onChange(newValue);
  }, [onChange]);

  // Get accurate caret position by inserting a temporary span
  const getCaretCoordinates = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return null;
    }

    const range = selection.getRangeAt(0).cloneRange();

    // Insert a temporary span at caret position
    const tempSpan = document.createElement("span");
    tempSpan.textContent = "\u200B"; // Zero-width space
    tempSpan.style.cssText = "position: relative;";

    range.insertNode(tempSpan);

    const spanRect = tempSpan.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();

    // Calculate position relative to editor
    const top = spanRect.bottom - editorRect.top + 4;
    const left = spanRect.left - editorRect.left;

    // Remove the temporary span
    tempSpan.parentNode?.removeChild(tempSpan);

    // Normalize to clean up any empty text nodes
    editorRef.current.normalize();

    return { top, left };
  }, []);

  // Handle keydown for @ detection
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "@" && !showPopover) {
        // Get caret position for popover placement
        const coords = getCaretCoordinates();
        if (coords) {
          setPopoverPosition(coords);
        }

        setSearchQuery("");
        setShowPopover(true);
      } else if (showPopover) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowPopover(false);
        } else if (e.key === "Backspace") {
          if (searchQuery.length === 0) {
            setShowPopover(false);
          } else {
            e.preventDefault();
            setSearchQuery((prev) => prev.slice(0, -1));
          }
        } else if (e.key === "Enter" && files.length > 0) {
          e.preventDefault();
          selectFile(files[0]);
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          // Let the command component handle arrow keys
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setSearchQuery((prev) => prev + e.key);
        }
      }
    },
    [showPopover, searchQuery, files, getCaretCoordinates]
  );

  // Select a file from the dropdown
  const selectFile = useCallback(
    (file: FileEntry) => {
      if (!editorRef.current) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);

      // Find and remove the @ symbol and any search text
      // Walk backwards from cursor to find @
      let node = range.startContainer;
      let offset = range.startOffset;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        // Find @ before cursor
        let atPos = -1;
        for (let i = offset - 1; i >= 0; i--) {
          if (text[i] === "@") {
            atPos = i;
            break;
          }
        }

        if (atPos >= 0) {
          // Remove @ and search query from text
          const before = text.slice(0, atPos);
          const after = text.slice(offset);

          // Create the file chip
          const chip = createFileChip(file.path, file.relativePath);

          // Replace text node content
          node.textContent = before;

          // Insert chip after the text node
          const parent = node.parentNode;
          if (parent) {
            // Create a text node for content after
            const afterNode = document.createTextNode(after);

            // Insert chip and after text
            if (node.nextSibling) {
              parent.insertBefore(afterNode, node.nextSibling);
              parent.insertBefore(chip, afterNode);
            } else {
              parent.appendChild(chip);
              parent.appendChild(afterNode);
            }

            // Move cursor after the chip
            const newRange = document.createRange();
            newRange.setStartBefore(afterNode);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      }

      setShowPopover(false);
      setSearchQuery("");

      // Update value
      handleInput();
    },
    [handleInput]
  );

  // Handle paste - strip formatting
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      range.deleteContents();

      const textNode = document.createTextNode(text);
      range.insertNode(textNode);

      // Move cursor to end of inserted text
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);

      handleInput();
    },
    [handleInput]
  );

  // Check if editor is empty for placeholder
  const [isEmpty, setIsEmpty] = useState(!value);

  const checkEmpty = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.textContent || "";
      setIsEmpty(text.trim().length === 0 && !editorRef.current.querySelector("[data-file-path]"));
    }
  }, []);

  useEffect(() => {
    checkEmpty();
  }, [value, checkEmpty]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPopover) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-smart-textarea-dropdown]") && !editorRef.current?.contains(target)) {
        setShowPopover(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);

  return (
    <div className="relative">
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            handleInput();
            checkEmpty();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={checkEmpty}
          onFocus={checkEmpty}
          className={cn(
            "min-h-[200px] w-full rounded-md border border-input bg-input/20 dark:bg-input/30 px-3 py-2 text-sm outline-none",
            "focus:border-ring focus:ring-[2px] focus:ring-ring/30",
            "whitespace-pre-wrap break-words",
            className
          )}
        />
        {isEmpty && (
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
      </div>

      {/* File search dropdown - positioned at cursor */}
      {showPopover && (
        <div
          data-smart-textarea-dropdown
          className="absolute z-50 w-80 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{
            top: popoverPosition.top,
            left: Math.min(popoverPosition.left, 100), // Clamp left position
          }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search files..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              autoFocus={false}
            />
            <CommandList>
              {isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Searching...
                </div>
              ) : files.length === 0 ? (
                <CommandEmpty>No files found.</CommandEmpty>
              ) : (
                <CommandGroup heading="Files">
                  {files.map((file) => (
                    <CommandItem
                      key={file.path}
                      value={file.path}
                      onSelect={() => selectFile(file)}
                      className="flex items-center gap-2"
                    >
                      <HugeiconsIcon
                        icon={file.isDirectory ? Folder01Icon : File01Icon}
                        className="size-4 shrink-0"
                        strokeWidth={2}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{file.name}</span>
                        <span className="truncate text-muted-foreground text-[10px]">
                          {file.relativePath}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

// Helper to get raw value from SmartTextarea (with file paths expanded)
export function getExpandedValue(value: string): string {
  // Remove the markers, keeping the file paths
  return value
    .replace(new RegExp(FILE_REF_START, "g"), "")
    .replace(new RegExp(FILE_REF_END, "g"), "");
}
