"use client";

// Web Speech API type declarations
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionResultItem;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionEventLocal extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEventLocal extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionLocal {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLocal) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLocal) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionLocal;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

import React, {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
  useRef,
} from "react";
import { createMemoryRouter, RouterProvider, MemoryRouter } from "react-router-dom";
import dynamic from "next/dynamic";
import {
  FolderOpen,
  Hammer,
  MousePointer2,
  NotebookPen,
  Sparkles,
  Crosshair,
  Send,
  Plus,
  X,
  ChevronRight,
  FileText,
  ArrowRight,
  RefreshCw,
  Mic,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Renderer, DataProvider, VisibilityProvider, ActionProvider } from "@json-render/react";
import type { UITree } from "@json-render/core";
// Types inlined (originally from router-with-box-model)
type RouteConfig = {
  path: string;
  name?: string;
};

type InspectedElement = {
  id: string;
  tagName: string;
  className: string;
  rect: DOMRect;
  computedStyle: {
    margin: string;
    padding: string;
    border: string;
    width: string;
    height: string;
  };
};

type InspectorContextType = {
  isEnabled: boolean;
  toggle: () => void;
  hoveredElement: InspectedElement | null;
  setHoveredElement: (element: InspectedElement | null) => void;
};

// Stub for getOutputRouteConfigs - reads from outputs folder
async function getOutputRouteConfigs(): Promise<RouteConfig[]> {
  try {
    const res = await fetch("/api/outputs-routes");
    if (res.ok) {
      return res.json();
    }
  } catch {
    // Fallback
  }
  return [];
}
import { registry } from "../try-jsonrender/registry";
import { useFollowUpStream } from "./useFollowUpStream";
import {
  loadTreeJson,
  saveTreeJson,
  createNewPage,
  addLinkToElement,
  readOutputsFileSystem,
  type OutputFileNode,
} from "./actions";
import { cn } from "@/lib/utils";
import { EmptyPageState } from "./error";
import { NotebookPanel } from "./components/NotebookPanel";
import { TodosPanel } from "./components/TodosPanel";
import { readSpecIndex, createInitialContext, getAllSpecsForPage, generateSpecTaskPrompt, type SpecIndex, type SelectorInfo, type SpecSummary } from "./spec-actions";

// ============ SPEECH TYPES ============
type SpeechState = "idle" | "recording" | "processing" | "speaking";

// ============ EXTENDED TYPES ============
interface SelectedComponent {
  id: string;
  tagName: string;
  className: string;
  textContent: string;
  rect: DOMRect;
}

interface ExtendedInspectorContextType extends InspectorContextType {
  selectedComponent: SelectedComponent | null;
  selectComponent: (component: SelectedComponent | null) => void;
  enable: () => void;
}

// ============ ELEVENLABS TTS FUNCTION ============
async function textToSpeech(text: string): Promise<void> {
  const response = await fetch("/api/elevenlabs/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate speech");
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      reject(new Error("Audio playback failed"));
    };
    audio.play();
  });
}

// ============ CONTEXTS ============
const InspectorContext = createContext<ExtendedInspectorContextType | null>(
  null
);

function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx)
    throw new Error("useInspector must be used within InspectorProvider");
  return ctx;
}

// ============ PROVIDERS ============
function InspectorProvider({ children }: { children: React.ReactNode }) {
  // Inspector is ON by default until user selects an element
  const [isEnabled, setIsEnabled] = useState(false);
  const [hoveredElement, setHoveredElement] =
    useState<InspectedElement | null>(null);
  const [selectedComponent, setSelectedComponent] =
    useState<SelectedComponent | null>(null);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      if (prev) setHoveredElement(null);
      return !prev;
    });
  }, []);

  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  const selectComponent = useCallback((component: SelectedComponent | null) => {
    setSelectedComponent(component);
    // Exit inspector mode when selecting
    if (component) {
      setIsEnabled(false);
      setHoveredElement(null);
    }
  }, []);

  return (
    <InspectorContext.Provider
      value={{
        isEnabled,
        toggle,
        enable,
        hoveredElement,
        setHoveredElement,
        selectedComponent,
        selectComponent,
      }}
    >
      {children}
    </InspectorContext.Provider>
  );
}

// ============ DYNAMIC IMPORTS FOR OUTPUT PAGES ============
function createDynamicPage(folderName: string) {
  return dynamic(
    () =>
      import(`@outputs/${folderName}/page`).catch(() => {
        // Return a component that renders the empty state
        return {
          default: () => <EmptyPageState folderName={folderName} />,
        };
      }),
    {
      loading: () => (
        <div className="flex h-full items-center justify-center p-6 text-gray-400">
          Loading {folderName}...
        </div>
      ),
    }
  );
}

// ============ AUTO INSPECTOR WRAPPER ============
function AutoInspector({ children }: { children: React.ReactNode }) {
  const { isEnabled, setHoveredElement, selectComponent } = useInspector();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const handleMouseOver = (e: MouseEvent) => {
      if (!isEnabled) return;
      const target = e.target as HTMLElement;
      if (!target || target === containerRef.current) return;

      const rect = target.getBoundingClientRect();
      const computed = window.getComputedStyle(target);

      setHoveredElement({
        id: target.id || "",
        tagName: target.tagName,
        className: target.className || "",
        rect,
        computedStyle: {
          margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
          padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
          border: `${computed.borderTopWidth} ${computed.borderTopStyle} ${computed.borderTopColor}`,
          width: computed.width,
          height: computed.height,
        },
      });
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!isEnabled) return;
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!containerRef.current?.contains(relatedTarget)) {
        setHoveredElement(null);
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!isEnabled) return;
      const target = e.target as HTMLElement;
      if (!target || target === containerRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = target.getBoundingClientRect();
      selectComponent({
        id: target.id || "",
        tagName: target.tagName,
        className: target.className || "",
        textContent: target.textContent?.trim() || "",
        rect,
      });
    };

    const container = containerRef.current;
    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);
    container.addEventListener("click", handleClick, true);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
      container.removeEventListener("click", handleClick, true);
    };
  }, [isEnabled, setHoveredElement, selectComponent]);

  return (
    <div ref={containerRef} className={isEnabled ? "cursor-crosshair" : ""}>
      {children}
    </div>
  );
}

// ============ HIGHLIGHT OVERLAY ============
function HighlightOverlay() {
  const { hoveredElement, isEnabled } = useInspector();

  if (!isEnabled || !hoveredElement) return null;

  const { rect } = hoveredElement;

  return (
    <div
      className="pointer-events-none fixed z-[9998] border-2 border-blue-500 bg-blue-500/10 transition-all duration-75"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      <div className="absolute -top-6 left-0 whitespace-nowrap rounded bg-blue-600 px-2 py-0.5 font-mono text-xs text-white">
        {hoveredElement.tagName.toLowerCase()}
        {hoveredElement.id && `#${hoveredElement.id}`}
        {hoveredElement.className &&
          typeof hoveredElement.className === "string" &&
          `.${hoveredElement.className.split(" ")[0]}`}
      </div>
    </div>
  );
}

// ============ FILE TREE NODE COMPONENT ============
interface FileTreeNodeProps {
  node: OutputFileNode;
  depth: number;
  currentRoutePath: string;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  onNavigate: (path: string) => void;
  onSpecsClick?: (pageName: string) => void;
  specIndex?: SpecIndex;
}

function FileTreeNode({
  node,
  depth,
  currentRoutePath,
  expandedFolders,
  onToggle,
  onNavigate,
  onSpecsClick,
  specIndex,
}: FileTreeNodeProps) {
  const isExpanded = expandedFolders.has(node.path);
  const isFolder = node.type === "folder";
  const isCurrentPage = currentRoutePath === `/${node.path}`;

  // Check if this folder has a page.tsx (is navigable)
  const hasPage = isFolder && node.children?.some(child => child.isPage);

  // Count specs for this folder (only for top-level page folders)
  const specCount = specIndex && isFolder && depth === 0
    ? Object.values(specIndex.elements).filter(e => e.hasSpec).length
    : 0;

  const getFileIcon = () => {
    if (node.isPage) return <FileText className="h-3.5 w-3.5 text-blue-400" />;
    if (node.isTree) return <FileText className="h-3.5 w-3.5 text-yellow-400" />;
    if (node.isRegistry) return <FileText className="h-3.5 w-3.5 text-green-400" />;
    return <FileText className="h-3.5 w-3.5 text-gray-400" />;
  };

  const handleSpecsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSpecsClick && isFolder) {
      onSpecsClick(node.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-1 cursor-pointer rounded text-xs transition-colors",
          "hover:bg-muted/50",
          isCurrentPage && isFolder && "bg-primary/10 text-primary font-medium"
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (isFolder) {
            onToggle(node.path);
            // Only navigate if the folder has a page.tsx
            if (hasPage) {
              onNavigate(node.path);
            }
          }
        }}
      >
        {isFolder && (
          <ChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        )}
        {!isFolder && <span className="w-3" />}

        {isFolder ? (
          <FolderOpen className={cn(
            "h-3.5 w-3.5",
            isExpanded ? "text-yellow-500" : "text-yellow-600",
            !hasPage && "opacity-50" // Dim folders without pages
          )} />
        ) : (
          getFileIcon()
        )}

        <span className="truncate flex-1">{node.name}</span>

        {/* Spec count badge for folders - clickable */}
        {specCount > 0 && (
          <Badge
            variant="secondary"
            className="text-[8px] px-1 py-0 h-4 bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer"
            onClick={handleSpecsClick}
          >
            {specCount} spec{specCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Children */}
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              currentRoutePath={currentRoutePath}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onNavigate={onNavigate}
              onSpecsClick={onSpecsClick}
              specIndex={specIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============ FLOATING PANEL TYPES ============
type ActivePanel = "pointer" | "ai" | "notes" | "tools" | "files";

const panelNames: Record<ActivePanel, string> = {
  pointer: "Select",
  ai: "AI Assist",
  notes: "Notes",
  tools: "Tools",
  files: "Files",
};

const panelDescriptions: Record<ActivePanel, string> = {
  pointer: "Click to select elements on the canvas",
  ai: "Get AI-powered suggestions and assistance",
  notes: "Write and organize your notes",
  tools: "Access build and development tools",
  files: "Browse and manage your project files",
};

// ============ INITIAL PROMPTS (for creating from scratch) ============
const EXAMPLE_PROMPTS = [
  "Create a welcome card with sparkles icon and get started button",
  "Build a metrics dashboard with revenue, users, and growth stats",
  "Design a contact form with name, email, and message fields",
  "Create a user profile card with avatar and bio section",
];

// ============ FOLLOWUP SUGGESTIONS ============
const FOLLOWUP_SUGGESTIONS = [
  "Add a heart icon next to the title",
  "Change the card to a warm gradient background",
  "Add a secondary button with outline variant",
  "Convert this to use tabs for different sections",
];

// ============ MAIN PAGE COMPONENT ============
function FloatingBarWithRouter() {
  // Start with pointer panel - inspector is ON by default until element selected
  const [activePanel, setActivePanel] = useState<ActivePanel>("tools");
  const [routes, setRoutes] = useState<RouteConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [router, setRouter] = useState<ReturnType<
    typeof createMemoryRouter
  > | null>(null);

  // Track current route path
  const [currentRoutePath, setCurrentRoutePath] = useState<string>("");

  // Follow-up prompt state
  const [followUpPrompt, setFollowUpPrompt] = useState("");
  const [persistedTree, setPersistedTree] = useState<UITree | null>(null);
  const [loadedTreeJson, setLoadedTreeJson] = useState<UITree | null>(null);

  // New page modal state
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [isCreatingPage, setIsCreatingPage] = useState(false);

  // File system state
  const [fileTree, setFileTree] = useState<OutputFileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Ref to track current folder for saving on completion
  const currentFolderRef = useRef<string>("");

  // ============ NOTEBOOK SPEC STATE ============
  const [specElementKey, setSpecElementKey] = useState<string | null>(null);
  const [specContext, setSpecContext] = useState<string>("");
  const [showElementSwitchConfirm, setShowElementSwitchConfirm] = useState(false);
  const [pendingElementKey, setPendingElementKey] = useState<string | null>(null);
  const [specIndex, setSpecIndex] = useState<SpecIndex>({ elements: {} });

  // ============ SPECS VIEWER MODAL STATE ============
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [specsModalPageName, setSpecsModalPageName] = useState<string>("");
  const [specsModalData, setSpecsModalData] = useState<SpecSummary[]>([]);
  const [isLoadingSpecs, setIsLoadingSpecs] = useState(false);
  const [selectedSpecIndex, setSelectedSpecIndex] = useState<number>(0);
  const [copiedSpecId, setCopiedSpecId] = useState<string | null>(null);
  const [isCopyingSpec, setIsCopyingSpec] = useState(false);

  // ============ VOICE/SPEECH STATE ============
  const [speechState, setSpeechState] = useState<SpeechState>("idle");
  const [isAutoTalkMode, setIsAutoTalkMode] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");

  // Voice-related refs
  const vKeyDownTimeRef = useRef<number>(0);
  const isVKeyHeldRef = useRef(false);
  const speechRecognitionRef = useRef<SpeechRecognitionLocal | null>(null);
  const autoTalkActiveRef = useRef(false);

  // useFollowUpStream for AI modifications
  const { tree: streamingTree, isStreaming, error: streamError, send, clear } = useFollowUpStream({
    api: "/api/json-render",
    onError: (err) => console.error("useFollowUpStream error:", err),
    onComplete: async (completedTree) => {
      setPersistedTree(completedTree);

      // Auto-save tree.json to file system after streaming completes
      const folderName = currentFolderRef.current;
      if (folderName) {
        try {
          const result = await saveTreeJson(completedTree, folderName);
          if (result.success) {
            console.log("Auto-saved tree.json:", result.message);
          } else {
            console.error("Failed to auto-save tree.json:", result.message);
          }
        } catch (err) {
          console.error("Error auto-saving tree.json:", err);
        }
      }
    },
  });

  const { isEnabled, toggle, enable, selectedComponent, selectComponent } =
    useInspector();

  // Determine display tree (streaming tree takes precedence, then persisted, then loaded from file)
  const displayTree = streamingTree ?? persistedTree ?? loadedTreeJson;

  // ============ SPEECH RECOGNITION SETUP ============
  const initSpeechRecognition = useCallback((): SpeechRecognitionLocal | null => {
    if (typeof window === "undefined") return null;

    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      console.warn("Speech recognition not supported");
      return null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventLocal) => {
      const results: SpeechRecognitionResult[] = [];
      for (let i = 0; i < event.results.length; i++) {
        results.push(event.results[i]);
      }
      const transcript = results
        .map((result) => result[0].transcript)
        .join("");
      setTranscribedText(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLocal) => {
      console.error("Speech recognition error:", event.error);
      setSpeechState("idle");
    };

    recognition.onend = () => {
      // This is called when recognition stops
      // If in auto-talk mode, we handle this in the processVoiceInput function
    };

    return recognition;
  }, []);

  // Start speech recognition
  const startRecording = useCallback(() => {
    if (speechState !== "idle") return;

    const recognition = initSpeechRecognition();
    if (!recognition) return;

    speechRecognitionRef.current = recognition;
    setTranscribedText("");
    setSpeechState("recording");
    recognition.start();
  }, [speechState, initSpeechRecognition]);

  // Stop recording and process
  const stopRecording = useCallback(() => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
  }, []);

  // Process voice input: submit to API and optionally speak response
  const processVoiceInput = useCallback(async (text: string) => {
    if (!text.trim()) {
      setSpeechState("idle");
      return;
    }

    setSpeechState("processing");

    // Submit the transcribed text to the API
    const currentTree = persistedTree ?? loadedTreeJson;
    if (currentTree) {
      await send(text, { currentTree });
    } else {
      await send(text);
    }

    // Speak a confirmation (TTS)
    setSpeechState("speaking");
    try {
      await textToSpeech("Got it. I'm updating the UI based on your request.");
    } catch (err) {
      console.error("TTS error:", err);
    }

    // If auto-talk mode is active, start listening again
    if (autoTalkActiveRef.current) {
      // Small delay before starting next recording
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (autoTalkActiveRef.current) {
        setTranscribedText("");
        setSpeechState("recording");
        const recognition = initSpeechRecognition();
        if (recognition) {
          speechRecognitionRef.current = recognition;
          recognition.start();
        } else {
          setSpeechState("idle");
          autoTalkActiveRef.current = false;
          setIsAutoTalkMode(false);
        }
      }
    } else {
      setSpeechState("idle");
    }
  }, [persistedTree, loadedTreeJson, send, initSpeechRecognition]);

  // Stop auto-talk mode
  const stopAutoTalk = useCallback(() => {
    autoTalkActiveRef.current = false;
    setIsAutoTalkMode(false);
    stopRecording();
    setSpeechState("idle");
  }, [stopRecording]);

  // Aura styles based on speech state
  const getAuraStyles = useCallback(() => {
    if (activePanel !== "tools") return "";

    switch (speechState) {
      case "recording":
        return "shadow-[0_0_30px_10px_rgba(200,160,100,0.6),0_0_60px_20px_rgba(200,160,100,0.35),0_0_90px_30px_rgba(200,160,100,0.15)]";
      case "processing":
        return "shadow-[0_0_15px_5px_rgba(180,110,110,0.5),0_0_30px_10px_rgba(180,110,110,0.25)]";
      case "speaking":
        return "shadow-[0_0_15px_5px_rgba(120,160,130,0.5),0_0_30px_10px_rgba(120,160,130,0.25)]";
      default:
        return "";
    }
  }, [speechState, activePanel]);

  // Hotkey 'c' to toggle inspector, 'v' for voice, Command+K to create new page, Enter to stop auto-talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command+K to create new page (only when element is selected)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (selectedComponent) {
          // Open modal to create new page
          setShowNewPageModal(true);
        }
        return;
      }

      // Enter key stops auto-talk mode
      if (e.key === "Enter" && isAutoTalkMode && !e.shiftKey) {
        // Only stop if not in an input field, or if explicitly in auto-talk
        if (
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          stopAutoTalk();
          return;
        }
      }

      // Don't trigger hotkeys if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // 'V' key for voice input (only when tools panel is active)
      if ((e.key === "v" || e.key === "V") && !e.repeat && activePanel === "tools") {
        if (speechState === "idle" && !isVKeyHeldRef.current) {
          isVKeyHeldRef.current = true;
          vKeyDownTimeRef.current = Date.now();
          startRecording();
        }
        return;
      }

      if (e.key === "c" || e.key === "C") {
        // In tools mode, switch to files panel and enable inspector
        if (activePanel === "tools") {
          setActivePanel("files");
          enable();
        } else {
          toggle();
        }
      }
    };

    const handleKeyUp = async (e: KeyboardEvent) => {
      // 'V' key released - stop recording and process
      if ((e.key === "v" || e.key === "V") && isVKeyHeldRef.current) {
        isVKeyHeldRef.current = false;
        const holdDuration = Date.now() - vKeyDownTimeRef.current;

        // Check if held for 5+ seconds -> enable auto-talk mode
        if (holdDuration >= 5000) {
          autoTalkActiveRef.current = true;
          setIsAutoTalkMode(true);
        }

        // Stop recording - the transcribed text will be processed
        stopRecording();

        // Small delay to ensure final transcription is captured
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Process the voice input
        await processVoiceInput(transcribedText);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [toggle, enable, selectedComponent, activePanel, speechState, startRecording, stopRecording, processVoiceInput, transcribedText, isAutoTalkMode, stopAutoTalk]);

  // Fetch routes from outputs folder on mount
  useEffect(() => {
    async function loadRoutes() {
      try {
        const configs = await getOutputRouteConfigs();
        setRoutes(configs);

        if (configs.length > 0) {
          const routeObjects = configs.map((config) => {
            const folderName = config.path.replace(/^\//, "");
            const PageComponent = createDynamicPage(folderName);
            return {
              path: config.path,
              element: <PageComponent />,
            };
          });

          const defaultRoute = {
            path: "/",
            element: (() => {
              const FirstPage = createDynamicPage(
                configs[0].path.replace(/^\//, "")
              );
              return <FirstPage />;
            })(),
          };

          const allRoutes =
            configs[0].path === "/"
              ? routeObjects
              : [defaultRoute, ...routeObjects];

          const newRouter = createMemoryRouter(allRoutes, {
            initialEntries: [configs[0].path],
            initialIndex: 0,
          });

          setRouter(newRouter);
        }
      } catch (error) {
        console.error("Failed to load output routes:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadRoutes();
  }, []);

  // Subscribe to router location changes to track current route
  useEffect(() => {
    if (!router) return;

    // Set initial route path
    setCurrentRoutePath(router.state.location.pathname);

    // Subscribe to route changes
    const unsubscribe = router.subscribe((state) => {
      setCurrentRoutePath(state.location.pathname);
    });

    return () => unsubscribe();
  }, [router]);

  // Load tree.json when hammer/tools or notes is active and route has one
  useEffect(() => {
    if (activePanel !== "tools" && activePanel !== "notes") {
      // Reset loaded tree when switching away from tools/notes
      setLoadedTreeJson(null);
      setPersistedTree(null);
      clear();
      return;
    }

    // Extract folder name from current route path
    const folderName = currentRoutePath.replace(/^\//, "") || routes[0]?.path.replace(/^\//, "");
    if (!folderName) return;

    // Store folder name in ref for auto-save on completion
    currentFolderRef.current = folderName;

    // Load tree.json for this route via server action
    async function fetchTree() {
      try {
        const treeData = await loadTreeJson(folderName);
        setLoadedTreeJson(treeData);
      } catch {
        setLoadedTreeJson(null);
      }
    }

    fetchTree();
  }, [activePanel, currentRoutePath, routes, clear]);

  // Follow-up prompt handlers
  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpPrompt.trim() || isStreaming) return;

    const currentTree = persistedTree ?? loadedTreeJson;
    if (currentTree) {
      await send(followUpPrompt, { currentTree });
    } else {
      await send(followUpPrompt);
    }
    setFollowUpPrompt("");
  };

  const handleFollowUpClick = async (suggestion: string) => {
    const currentTree = persistedTree ?? loadedTreeJson;
    if (currentTree) {
      await send(suggestion, { currentTree });
    } else {
      await send(suggestion);
    }
  };

  // Handler for initial prompts (creating from scratch, no existing tree)
  const handleExampleClick = async (example: string) => {
    setFollowUpPrompt("");
    await send(example);
  };

  const handleFollowUpKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleFollowUpSubmit(e as unknown as React.FormEvent);
    }
  };

  // Load file system for the files panel
  const loadFileSystem = useCallback(async () => {
    setIsLoadingFiles(true);
    try {
      const tree = await readOutputsFileSystem();
      setFileTree(tree);
    } catch (err) {
      console.error("Failed to load file system:", err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  // Open specs viewer modal
  const handleOpenSpecsModal = useCallback(async (pageName: string) => {
    setSpecsModalPageName(pageName);
    setShowSpecsModal(true);
    setIsLoadingSpecs(true);
    setSelectedSpecIndex(0);
    setCopiedSpecId(null);

    try {
      const specs = await getAllSpecsForPage(pageName);
      setSpecsModalData(specs);
    } catch (err) {
      console.error("Failed to load specs:", err);
      setSpecsModalData([]);
    } finally {
      setIsLoadingSpecs(false);
    }
  }, []);

  // Copy spec task prompt to clipboard
  const handleCopySpecPrompt = useCallback(async (spec: SpecSummary) => {
    setIsCopyingSpec(true);
    try {
      const taskPrompt = await generateSpecTaskPrompt(
        specsModalPageName,
        spec.componentId,
        spec.elementKey || spec.componentId,
        spec.content
      );
      await navigator.clipboard.writeText(taskPrompt);
      setCopiedSpecId(spec.componentId);
      setTimeout(() => setCopiedSpecId(null), 2000);
    } catch (err) {
      console.error("Failed to copy spec prompt:", err);
    } finally {
      setIsCopyingSpec(false);
    }
  }, [specsModalPageName]);

  // ============ SPEC MODE HELPERS ============
  // Find element key from tree.json that matches selected DOM element
  const findElementKeyFromSelection = useCallback(
    (tree: UITree | null, selected: SelectedComponent | null): string | null => {
      if (!tree || !selected) return null;

      const { textContent, tagName, className } = selected;
      const tagLower = tagName.toLowerCase();
      const trimmedText = textContent?.trim() || "";

      // First pass: exact text content match
      for (const [key, element] of Object.entries(tree.elements)) {
        const props = element.props || {};

        // Match by exact text content
        if (props.label === trimmedText) return key;
        if (props.text === trimmedText) return key;
        if (props.title === trimmedText) return key;
        if (props.description === trimmedText) return key;
      }

      // Second pass: partial text match (text contains or is contained)
      for (const [key, element] of Object.entries(tree.elements)) {
        const props = element.props || {};

        if (trimmedText && trimmedText.length > 2) {
          if (typeof props.label === "string" && trimmedText.includes(props.label)) return key;
          if (typeof props.text === "string" && trimmedText.includes(props.text)) return key;
          if (typeof props.title === "string" && trimmedText.includes(props.title)) return key;
        }
      }

      // Third pass: match by tag/type pattern
      for (const [key, element] of Object.entries(tree.elements)) {
        const typeLower = element.type.toLowerCase();

        // Match button tags to Button type
        if (tagLower === "button" && typeLower === "button") return key;
        // Match heading tags
        if (tagLower.match(/^h[1-6]$/) && typeLower === "heading") return key;
        // Match by className containing the key
        if (className && typeof className === "string" && className.includes(key)) return key;
      }

      // Fallback: if only one element of matching tag type exists, use it
      const matchingTypeElements = Object.entries(tree.elements).filter(([, el]) =>
        el.type.toLowerCase() === tagLower ||
        (tagLower === "button" && el.type === "Button") ||
        (tagLower.match(/^h[1-6]$/) && el.type === "Heading")
      );

      if (matchingTypeElements.length === 1) {
        return matchingTypeElements[0][0];
      }

      // Last resort: return the root element if nothing matches
      if (tree.root && tree.elements[tree.root]) {
        return tree.root;
      }

      return null;
    },
    []
  );

  // Handle element selection for spec mode
  const handleSpecElementSelection = useCallback(
    (newElementKey: string | null) => {
      if (!newElementKey) return;

      if (specElementKey && specElementKey !== newElementKey) {
        // Different element - show confirmation
        setPendingElementKey(newElementKey);
        setShowElementSwitchConfirm(true);
      } else if (!specElementKey) {
        // First selection - start conversation
        setSpecElementKey(newElementKey);
      }
    },
    [specElementKey]
  );

  // Confirm element switch
  const confirmElementSwitch = useCallback(() => {
    setSpecElementKey(pendingElementKey);
    setPendingElementKey(null);
    setShowElementSwitchConfirm(false);
  }, [pendingElementKey]);

  // Cancel element switch
  const cancelElementSwitch = useCallback(() => {
    setPendingElementKey(null);
    setShowElementSwitchConfirm(false);
  }, []);

  // Load file system on mount
  useEffect(() => {
    loadFileSystem();
  }, [loadFileSystem]);

  // Reload when files panel is selected
  useEffect(() => {
    if (activePanel === "files") {
      loadFileSystem();
    }
  }, [activePanel, loadFileSystem]);

  // Load spec index when notes panel is active
  useEffect(() => {
    if (activePanel === "notes") {
      const folderName = currentFolderRef.current || currentRoutePath.replace(/^\//, "");
      if (folderName) {
        readSpecIndex(folderName).then(setSpecIndex);
      }
    }
  }, [activePanel, currentRoutePath]);

  // Track which component we've already created context for
  const contextCreatedForRef = useRef<string | null>(null);

  // When element is selected via inspector, immediately create context file and switch to notes panel
  useEffect(() => {
    if (!selectedComponent) {
      contextCreatedForRef.current = null;
      return;
    }

    // Create a unique key for this selection to avoid duplicate context creation
    const selectionKey = `${selectedComponent.tagName}-${selectedComponent.textContent?.slice(0, 30)}`;
    if (contextCreatedForRef.current === selectionKey) {
      return; // Already created context for this selection
    }

    const folderName = currentFolderRef.current || currentRoutePath.replace(/^\//, "");
    if (!folderName) return;

    // Build selector info from the selected DOM element
    const selectors: SelectorInfo = {
      tagName: selectedComponent.tagName,
      className: selectedComponent.className,
      textContent: selectedComponent.textContent,
      id: selectedComponent.id || undefined,
    };

    // Try to find the elementKey if we have a tree loaded
    let elementKey = selectedComponent.id || selectedComponent.textContent?.slice(0, 20) || "selected-element";
    if (loadedTreeJson) {
      const foundKey = findElementKeyFromSelection(loadedTreeJson, selectedComponent);
      if (foundKey) {
        elementKey = foundKey;
        selectors.elementKey = foundKey;
      }
    }

    // Mark as creating context for this selection
    contextCreatedForRef.current = selectionKey;

    // Create initial context file immediately
    console.log("[page] Creating initial context for:", { folderName, elementKey, selectors });
    createInitialContext(folderName, elementKey, selectors).then((result) => {
      console.log("[page] Initial context created:", result);
      if (result.success) {
        // Set the spec element key directly
        setSpecElementKey(elementKey);
        // Auto-switch to notes panel to start the conversation
        if (activePanel !== "notes") {
          setActivePanel("notes");
        }
      }
    });
  }, [selectedComponent, currentRoutePath, loadedTreeJson, findElementKeyFromSelection, activePanel]);

  // Trigger spec conversation when element selected + notes panel active
  useEffect(() => {
    if (activePanel !== "notes" || !selectedComponent || !loadedTreeJson) return;

    const elementKey = findElementKeyFromSelection(loadedTreeJson, selectedComponent);
    if (elementKey) {
      handleSpecElementSelection(elementKey);
    }
  }, [activePanel, selectedComponent, loadedTreeJson, findElementKeyFromSelection, handleSpecElementSelection]);

  // Clear spec element when switching away from notes panel
  useEffect(() => {
    if (activePanel !== "notes") {
      setSpecElementKey(null);
      setSpecContext("");
    }
  }, [activePanel]);

  // Create new page handler - creates a new page and links the selected element to it
  const handleCreateNewPage = useCallback(async (customName?: string) => {
    setIsCreatingPage(true);
    try {
      const currentFolderName = currentFolderRef.current;

      // First save current tree if we have one
      const currentTree = persistedTree ?? loadedTreeJson;
      if (currentTree && currentFolderName) {
        await saveTreeJson(currentTree, currentFolderName);
        console.log("Saved current tree before creating new page");
      }

      // Create the new page
      const result = await createNewPage(undefined, customName);

      if (result.success && result.folderName) {
        console.log("Created new page:", result.folderName);

        // If we have a selected component, link it to the new page
        if (selectedComponent && currentFolderName) {
          const linkResult = await addLinkToElement(
            currentFolderName,
            {
              id: selectedComponent.id,
              tagName: selectedComponent.tagName,
              className: selectedComponent.className,
              textContent: selectedComponent.textContent,
            },
            `/${result.folderName}`
          );

          if (linkResult.success) {
            console.log("Added link to element:", linkResult.message);
            // Update persisted tree with the linked version
            if (linkResult.tree) {
              setPersistedTree(linkResult.tree);
            }
          } else {
            console.warn("Could not add link to element:", linkResult.message);
          }
        }

        // Refresh routes to include new page
        const configs = await getOutputRouteConfigs();
        setRoutes(configs);

        // Create new router with the new page as initial route
        if (configs.length > 0) {
          const routeObjects = configs.map((config) => {
            const fName = config.path.replace(/^\//, "");
            const PageComponent = createDynamicPage(fName);
            return {
              path: config.path,
              element: <PageComponent />,
            };
          });

          const defaultRoute = {
            path: "/",
            element: (() => {
              const FirstPage = createDynamicPage(configs[0].path.replace(/^\//, ""));
              return <FirstPage />;
            })(),
          };

          const allRoutes =
            configs[0].path === "/" ? routeObjects : [defaultRoute, ...routeObjects];

          // Create router starting at the new page
          const newRouter = createMemoryRouter(allRoutes, {
            initialEntries: [`/${result.folderName}`],
            initialIndex: 0,
          });

          setRouter(newRouter);
        }

        // Update current folder ref to the new page
        currentFolderRef.current = result.folderName;

        // Clear existing tree state so new page's tree.json gets loaded
        setPersistedTree(null);
        setLoadedTreeJson(null);
        clear(); // Clear any streaming state

        // Clear selected component since we've linked it
        selectComponent(null);

        // Reload file system
        await loadFileSystem();

        // Load the new page's tree.json (will be the default placeholder)
        try {
          const newTree = await loadTreeJson(result.folderName);
          setLoadedTreeJson(newTree);
        } catch {
          // New page will have default tree, that's fine
        }

        // Switch to tools/hammer panel AFTER all state is ready
        setActivePanel("tools");

        // Close modal
        setShowNewPageModal(false);
        setNewPageName("");
      } else {
        console.error("Failed to create new page:", result.message);
      }
    } catch (err) {
      console.error("Error creating new page:", err);
    } finally {
      setIsCreatingPage(false);
    }
  }, [persistedTree, loadedTreeJson, loadFileSystem, selectedComponent, selectComponent, clear]);

  // Determine if we're in follow-up mode (have a tree to modify)
  const isFollowUpMode = displayTree !== null;

  return (
    <div className="relative h-screen p-4 pb-8">
      {/* Main content area - conditionally shows json-render or Router */}
      <div className="flex h-full w-full items-center justify-center overflow-auto rounded-lg bg-muted-foreground">
        {isLoading ? (
          <span className="text-2xl font-medium text-background">
            Loading...
          </span>
        ) : activePanel === "tools" ? (
          // When hammer/tools is active, show json-render UI
          <div className="h-full w-full overflow-auto p-6">
            {displayTree ? (
              <MemoryRouter>
                <DataProvider>
                  <VisibilityProvider>
                    <ActionProvider>
                      <div className="space-y-4">
                        <Renderer tree={displayTree} registry={registry} loading={isStreaming} />
                      </div>
                    </ActionProvider>
                  </VisibilityProvider>
                </DataProvider>
              </MemoryRouter>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-background/10">
                  <Sparkles className="size-8 text-background/60" />
                </div>
                <p className="text-lg font-medium text-background">Create your first UI</p>
                <p className="mt-2 max-w-[280px] text-sm text-background/70">
                  Use the prompt input in the sidebar to describe the UI you want to generate
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-background/50">
                  <ArrowRight className="size-3" />
                  <span>Try an example prompt to get started</span>
                </div>
              </div>
            )}
          </div>
        ) : router ? (
          <AutoInspector>
            <ScrollArea className="h-full w-full p-6">
              <RouterProvider router={router} />
            </ScrollArea>
          </AutoInspector>
        ) : routes.length === 0 ? (
          <span className="text-2xl font-medium text-background">
            No output pages found
          </span>
        ) : (
          <span className="text-2xl font-medium text-background">
            {panelNames[activePanel]}
          </span>
        )}
      </div>

      {/* Highlight overlay for inspector */}
      <HighlightOverlay />

      {/* Floating panel bottom right - hidden in pointer mode */}
      {activePanel !== "pointer" && (
        <div className="fixed bottom-3 right-2 z-30 flex w-72 flex-col rounded-lg border bg-gray-100 p-4 shadow-lg">
          {/* Inspector toggle button - hidden in tools mode */}
          {activePanel !== "tools" && (
            <>
              <div className="mb-3 flex items-center gap-2">
                <Button
                  onClick={toggle}
                  size="sm"
                  variant={isEnabled ? "default" : "outline"}
                  className="flex-1 gap-2"
                >
                  <Crosshair className="h-4 w-4" />
                  {isEnabled ? "Inspector ON" : "Inspector OFF"}
                </Button>
                <span className="text-xs text-muted-foreground">Press C</span>
              </div>

              {/* Selected component display */}
            </>
          )}

          {/* Panel content - show prompt input when tools/hammer is active */}
          {activePanel === "tools" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">
                  {isFollowUpMode ? "Modify UI" : "Create UI"}
                </h3>
                {isStreaming && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                    {isFollowUpMode ? "Modifying..." : "Generating..."}
                  </span>
                )}
              </div>

              {/* Prompt input */}
              <form onSubmit={handleFollowUpSubmit} className="space-y-2">
                <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm focus-within:border-primary/30">
                  <Textarea
                    value={followUpPrompt}
                    onChange={(e) => setFollowUpPrompt(e.target.value)}
                    onKeyDown={handleFollowUpKeyDown}
                    placeholder={
                      isFollowUpMode
                        ? "Describe how to modify the UI..."
                        : "Describe the UI you want to create..."
                    }
                    disabled={isStreaming}
                    className="min-h-[60px] resize-none border-0 bg-transparent px-3 py-2 text-xs focus-visible:ring-0 disabled:opacity-50"
                    rows={2}
                  />
                  <div className="flex items-center justify-end border-t border-border/40 bg-muted/20 px-2 py-1.5">
                    <button
                      type="submit"
                      disabled={isStreaming || !followUpPrompt.trim()}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
                        followUpPrompt.trim() && !isStreaming
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground cursor-not-allowed"
                      )}
                    >
                      <Send className="size-3" />
                      {isFollowUpMode ? "Modify" : "Generate"}
                    </button>
                  </div>
                </div>
              </form>

              {/* Suggestions - different for initial vs follow-up mode */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  {isFollowUpMode ? "Suggestions" : "Try an example"}
                </p>
                <div className="flex flex-wrap gap-1">
                  {isFollowUpMode ? (
                    FOLLOWUP_SUGGESTIONS.slice(0, 3).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleFollowUpClick(suggestion)}
                        disabled={isStreaming}
                        className="rounded border border-primary/30 bg-primary/5 px-2 py-1 text-left text-[10px] text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))
                  ) : (
                    EXAMPLE_PROMPTS.slice(0, 3).map((example, index) => (
                      <button
                        key={index}
                        onClick={() => handleExampleClick(example)}
                        disabled={isStreaming}
                        className="rounded border border-border/60 bg-background px-2 py-1 text-left text-[10px] text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                      >
                        {example}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Error display */}
              {streamError && (
                <div className="rounded bg-destructive/10 p-2 text-[10px] text-destructive">
                  Error: {streamError.message}
                </div>
              )}

              {/* Voice Input Section */}
              <div className="border-t border-border/50 pt-3 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {speechState === "recording" ? (
                      <div className="flex items-center gap-2 text-amber-600">
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                        </span>
                        <span className="text-xs font-medium">Recording...</span>
                      </div>
                    ) : speechState === "processing" ? (
                      <div className="flex items-center gap-2 text-rose-400">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-400 border-t-transparent" />
                        <span className="text-xs font-medium">Processing...</span>
                      </div>
                    ) : speechState === "speaking" ? (
                      <div className="flex items-center gap-2 text-emerald-600">
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                        </span>
                        <span className="text-xs font-medium">Speaking...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mic className="h-3 w-3" />
                        <span className="text-xs">Voice ready</span>
                      </div>
                    )}
                  </div>
                  {isAutoTalkMode && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-700">
                      Auto-talk ON
                    </Badge>
                  )}
                </div>

                {/* Transcribed text preview */}
                {transcribedText && speechState === "recording" && (
                  <div className="mb-2 rounded bg-muted/50 p-2 text-xs text-muted-foreground italic">
                    &ldquo;{transcribedText}&rdquo;
                  </div>
                )}

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono">V</kbd>
                  <span>Hold to speak{isAutoTalkMode ? " • Enter to stop" : " • 5s for auto-talk"}</span>
                </div>

                {isAutoTalkMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={stopAutoTalk}
                    className="w-full mt-2 gap-1 text-xs"
                  >
                    <X className="h-3 w-3" />
                    Stop Auto-talk
                  </Button>
                )}
              </div>
            </div>
          ) : activePanel === "notes" ? (
            <div className="h-[320px]">
              <NotebookPanel
                pageName={currentFolderRef.current || currentRoutePath.replace(/^\//, "") || ""}
                elementKey={specElementKey}
                tree={loadedTreeJson}
                initialContext={specContext}
                onContextUpdate={(content) => setSpecContext(content)}
                onElementKeyChange={(key) => setSpecElementKey(key)}
              />
            </div>
          ) : activePanel === "ai" ? (
            <div className="h-[320px]">
              <TodosPanel
                currentPage={currentFolderRef.current || currentRoutePath.replace(/^\//, "")}
              />
            </div>
          ) : activePanel === "files" ? (
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Pages</h3>
                <button
                  onClick={loadFileSystem}
                  disabled={isLoadingFiles}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoadingFiles && "animate-spin")} />
                </button>
              </div>

              {/* File Tree */}
              <ScrollArea className="h-[200px] -mx-2 px-2">
                {fileTree.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No pages yet</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {fileTree.map((node) => (
                      <FileTreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        currentRoutePath={currentRoutePath}
                        expandedFolders={expandedFolders}
                        onToggle={toggleFolder}
                        onNavigate={(path) => {
                          if (router) {
                            router.navigate(`/${path}`);
                          }
                        }}
                        onSpecsClick={handleOpenSpecsModal}
                        specIndex={node.path === currentRoutePath.replace(/^\//, "") ? specIndex : undefined}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : activePanel !== "pointer" && !selectedComponent ? (
            <>
              <h3 className="font-semibold">{panelNames[activePanel]}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {panelDescriptions[activePanel]}
              </p>
            </>
          ) : null}

          {/* Inspector hint when active */}
          {isEnabled && (
            <div className="mt-2 rounded bg-blue-100 p-2 text-xs text-blue-700">
              Click on any element to select it
            </div>
          )}
        </div>
      )}

      {/* Floating bar at bottom with voice aura effect */}
      <div
        className={cn(
          "fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full border bg-background/95 px-1.5 py-1 shadow-lg backdrop-blur-sm transition-shadow duration-300",
          getAuraStyles()
        )}
      >
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("pointer")}
          size="icon"
          variant={activePanel === "pointer" ? "default" : "ghost"}
        >
          <MousePointer2 className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("ai")}
          size="icon"
          variant={activePanel === "ai" ? "default" : "ghost"}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("notes")}
          size="icon"
          variant={activePanel === "notes" ? "default" : "ghost"}
        >
          <NotebookPen className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("tools")}
          size="icon"
          variant={activePanel === "tools" ? "default" : "ghost"}
        >
          <Hammer className="h-4 w-4" />
        </Button>
        <Button
          className="h-8 w-8 rounded-full"
          onClick={() => setActivePanel("files")}
          size="icon"
          variant={activePanel === "files" ? "default" : "ghost"}
        >
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>

      {/* New Page Modal */}
      {showNewPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowNewPageModal(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Page</h2>
              <button
                onClick={() => setShowNewPageModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedComponent && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-medium text-blue-800 mb-1">
                  Linking from selected element:
                </p>
                <p className="font-mono text-xs text-blue-700">
                  {selectedComponent.tagName.toLowerCase()}
                  {selectedComponent.textContent && (
                    <span className="text-blue-600">
                      {" → "}&quot;{selectedComponent.textContent.slice(0, 30)}
                      {selectedComponent.textContent.length > 30 ? "..." : ""}&quot;
                    </span>
                  )}
                </p>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateNewPage(newPageName || undefined);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Page Name (optional)
                </label>
                <Input
                  type="text"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="e.g., settings, dashboard"
                  className="w-full"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Leave empty for auto-generated name (page-1, page-2, etc.)
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewPageModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isCreatingPage}>
                  {isCreatingPage ? (
                    <>
                      <span className="mr-2 size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" />
                      Create Page
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Element Switch Confirmation Dialog */}
      {showElementSwitchConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={cancelElementSwitch}
          />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="font-semibold mb-2">Switch Element?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You have an active spec conversation for{" "}
              <span className="font-mono text-foreground">{specElementKey}</span>.
              Switch to the new element?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={cancelElementSwitch}>
                Cancel
              </Button>
              <Button onClick={confirmElementSwitch}>
                Switch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Specs Viewer Modal */}
      {showSpecsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowSpecsModal(false)}
          />
          <div className="relative z-10 w-full max-w-3xl max-h-[80vh] rounded-xl border border-border bg-background shadow-xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold">
                  Specs for <span className="font-mono text-purple-600">{specsModalPageName}</span>
                </h3>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700">
                  {specsModalData.length} spec{specsModalData.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowSpecsModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Modal Body */}
            {isLoadingSpecs ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-sm text-muted-foreground">Loading specs...</div>
              </div>
            ) : specsModalData.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No specs found</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0">
                {/* Spec List Sidebar */}
                <div className="w-48 border-r flex flex-col min-h-0">
                  <div className="shrink-0 p-2 border-b bg-muted/30">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Components</p>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-1">
                      {specsModalData.map((spec, index) => (
                        <button
                          key={spec.componentId}
                          onClick={() => setSelectedSpecIndex(index)}
                          className={cn(
                            "w-full text-left px-2 py-1.5 rounded text-xs transition-colors",
                            selectedSpecIndex === index
                              ? "bg-purple-100 text-purple-700"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div className="font-mono truncate">
                            {spec.elementKey || spec.componentId}
                          </div>
                          <div className="text-[9px] text-muted-foreground truncate">
                            {new Date(spec.lastUpdated).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Spec Content */}
                <div className="flex-1 flex flex-col min-w-0 min-h-0">
                  <div className="shrink-0 p-2 border-b bg-muted/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                        {specsModalData[selectedSpecIndex]?.componentId}
                      </Badge>
                      {specsModalData[selectedSpecIndex]?.selectors.textContent && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          "{specsModalData[selectedSpecIndex].selectors.textContent.slice(0, 30)}"
                        </span>
                      )}
                    </div>
                    {/* Copy Prompt Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 gap-1 text-[10px] shrink-0"
                      onClick={() => specsModalData[selectedSpecIndex] && handleCopySpecPrompt(specsModalData[selectedSpecIndex])}
                      disabled={isCopyingSpec || !specsModalData[selectedSpecIndex]}
                    >
                      {copiedSpecId === specsModalData[selectedSpecIndex]?.componentId ? (
                        <>
                          <Check className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy Prompt
                        </>
                      )}
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4">
                      {specsModalData[selectedSpecIndex]?.content ? (
                        <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                          {specsModalData[selectedSpecIndex].content}
                        </pre>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No content yet</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ EXPORTED PAGE COMPONENT ============
export default function FloatingBarPage() {
  return (
    <InspectorProvider>
      <FloatingBarWithRouter />
    </InspectorProvider>
  );
}
