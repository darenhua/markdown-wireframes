"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

// ============ TYPES ============
interface InspectedElement {
  id: string;
  tagName: string;
  className: string;
  rect: DOMRect;
  computedStyle?: {
    margin: string;
    padding: string;
    border: string;
    width: string;
    height: string;
  };
}

interface InspectorContextType {
  isEnabled: boolean;
  toggle: () => void;
  hoveredElement: InspectedElement | null;
  setHoveredElement: (el: InspectedElement | null) => void;
}

// ============ CONTEXT ============
const InspectorContext = createContext<InspectorContextType | null>(null);

function useInspector() {
  const ctx = useContext(InspectorContext);
  if (!ctx) throw new Error("useInspector must be used within InspectorProvider");
  return ctx;
}

// ============ PROVIDER ============
function InspectorProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<InspectedElement | null>(null);

  const toggle = useCallback(() => {
    setIsEnabled((prev) => {
      if (prev) setHoveredElement(null);
      return !prev;
    });
  }, []);

  return (
    <InspectorContext.Provider
      value={{ isEnabled, toggle, hoveredElement, setHoveredElement }}
    >
      {children}
    </InspectorContext.Provider>
  );
}

// ============ TOGGLE BUTTON (Fixed) ============
function InspectorToggle() {
  const { isEnabled, toggle } = useInspector();

  return (
    <button
      onClick={toggle}
      className={`fixed top-4 right-4 z-[9999] px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-lg ${
        isEnabled
          ? "bg-blue-600 text-white ring-2 ring-blue-400"
          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
      }`}
    >
      {isEnabled ? "🔍 Inspector ON" : "🔍 Inspector OFF"}
    </button>
  );
}

// ============ HIGHLIGHT OVERLAY ============
function HighlightOverlay() {
  const { hoveredElement, isEnabled } = useInspector();

  if (!isEnabled || !hoveredElement) return null;

  const { rect } = hoveredElement;

  return (
    <div
      className="fixed pointer-events-none z-[9998] border-2 border-blue-500 bg-blue-500/10 transition-all duration-75"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      {/* Tag label */}
      <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-0.5 rounded font-mono">
        {hoveredElement.tagName.toLowerCase()}
        {hoveredElement.id && `#${hoveredElement.id}`}
        {hoveredElement.className && `.${hoveredElement.className.split(" ")[0]}`}
      </div>
    </div>
  );
}

// ============ INSPECTOR PANEL ============
function InspectorPanel() {
  const { hoveredElement, isEnabled } = useInspector();

  if (!isEnabled) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9999] w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl text-sm font-mono">
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800 rounded-t-lg">
        <span className="text-blue-400">Element Inspector</span>
      </div>
      <div className="p-3 space-y-2 text-gray-300 max-h-64 overflow-auto">
        {hoveredElement ? (
          <>
            <div>
              <span className="text-purple-400">Tag: </span>
              <span className="text-green-400">{hoveredElement.tagName.toLowerCase()}</span>
            </div>
            {hoveredElement.id && (
              <div>
                <span className="text-purple-400">ID: </span>
                <span className="text-yellow-400">#{hoveredElement.id}</span>
              </div>
            )}
            {hoveredElement.className && (
              <div>
                <span className="text-purple-400">Class: </span>
                <span className="text-orange-400">.{hoveredElement.className.replace(/\s+/g, " .")}</span>
              </div>
            )}
            <div className="border-t border-gray-700 pt-2 mt-2">
              <span className="text-blue-400 block mb-1">Box Model:</span>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <span className="text-gray-500">width: </span>
                  <span>{Math.round(hoveredElement.rect.width)}px</span>
                </div>
                <div>
                  <span className="text-gray-500">height: </span>
                  <span>{Math.round(hoveredElement.rect.height)}px</span>
                </div>
                <div>
                  <span className="text-gray-500">top: </span>
                  <span>{Math.round(hoveredElement.rect.top)}px</span>
                </div>
                <div>
                  <span className="text-gray-500">left: </span>
                  <span>{Math.round(hoveredElement.rect.left)}px</span>
                </div>
              </div>
            </div>
            {hoveredElement.computedStyle && (
              <div className="border-t border-gray-700 pt-2 mt-2">
                <span className="text-blue-400 block mb-1">Computed:</span>
                <div className="text-xs space-y-0.5">
                  <div>
                    <span className="text-gray-500">margin: </span>
                    <span className="text-orange-300">{hoveredElement.computedStyle.margin}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">padding: </span>
                    <span className="text-green-300">{hoveredElement.computedStyle.padding}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">border: </span>
                    <span className="text-yellow-300">{hoveredElement.computedStyle.border}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-500 italic">Hover over an element to inspect</div>
        )}
      </div>
    </div>
  );
}

// ============ INSPECTABLE WRAPPER ============
function Inspectable({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  const { isEnabled, setHoveredElement } = useInspector();
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (!isEnabled || !ref.current) return;

    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);

    setHoveredElement({
      id: id || el.id || "",
      tagName: el.tagName,
      className: el.className,
      rect,
      computedStyle: {
        margin: `${computed.marginTop} ${computed.marginRight} ${computed.marginBottom} ${computed.marginLeft}`,
        padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
        border: `${computed.borderTopWidth} ${computed.borderTopStyle} ${computed.borderTopColor}`,
        width: computed.width,
        height: computed.height,
      },
    });
  }, [isEnabled, setHoveredElement, id]);

  const handleMouseLeave = useCallback(() => {
    if (!isEnabled) return;
    setHoveredElement(null);
  }, [isEnabled, setHoveredElement]);

  return (
    <div
      ref={ref}
      id={id}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={isEnabled ? "cursor-crosshair" : ""}
    >
      {children}
    </div>
  );
}

// ============ AUTO INSPECTOR (for any element) ============
function AutoInspector({ children }: { children: React.ReactNode }) {
  const { isEnabled, setHoveredElement } = useInspector();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEnabled || !containerRef.current) return;

    const handleMouseOver = (e: MouseEvent) => {
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
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!containerRef.current?.contains(relatedTarget)) {
        setHoveredElement(null);
      }
    };

    const container = containerRef.current;
    container.addEventListener("mouseover", handleMouseOver);
    container.addEventListener("mouseout", handleMouseOut);

    return () => {
      container.removeEventListener("mouseover", handleMouseOver);
      container.removeEventListener("mouseout", handleMouseOut);
    };
  }, [isEnabled, setHoveredElement]);

  return (
    <div ref={containerRef} className={isEnabled ? "cursor-crosshair" : ""}>
      {children}
    </div>
  );
}

// ============ DEMO COMPONENTS ============
function DemoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <div className="text-gray-400">{children}</div>
    </div>
  );
}

function DemoButton({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  return (
    <button
      className={`px-4 py-2 rounded-md font-medium transition-colors ${
        variant === "primary"
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "bg-gray-600 text-gray-200 hover:bg-gray-500"
      }`}
    >
      {variant === "primary" ? "Primary" : "Secondary"}
    </button>
  );
}

function DemoNavbar() {
  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
      <div className="text-xl font-bold text-white">Logo</div>
      <div className="flex gap-4">
        <a href="#" className="text-gray-300 hover:text-white">Home</a>
        <a href="#" className="text-gray-300 hover:text-white">About</a>
        <a href="#" className="text-gray-300 hover:text-white">Contact</a>
      </div>
    </nav>
  );
}

// ============ MAIN PAGE ============
export default function BoxModelPage() {
  return (
    <InspectorProvider>
      <div className="min-h-screen bg-gray-950 text-white">
        <InspectorToggle />
        <HighlightOverlay />
        <InspectorPanel />

        <div className="p-6 space-y-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Box Model Inspector</h1>
            <p className="text-gray-400">
              Toggle the inspector (top right) and hover over elements to see their box model info.
            </p>
          </div>

          {/* Using AutoInspector - automatically inspects any nested element */}
          <AutoInspector>
            <div className="space-y-6">
              <DemoNavbar />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <DemoCard title="Card One">
                  <p className="mb-3">This is a demo card with some content.</p>
                  <DemoButton variant="primary" />
                </DemoCard>

                <DemoCard title="Card Two">
                  <p className="mb-3">Another card to inspect.</p>
                  <DemoButton variant="secondary" />
                </DemoCard>

                <DemoCard title="Card Three">
                  <div className="space-y-2">
                    <div className="bg-gray-700 p-2 rounded">Nested div 1</div>
                    <div className="bg-gray-700 p-2 rounded">Nested div 2</div>
                    <div className="bg-gray-700 p-2 rounded">Nested div 3</div>
                  </div>
                </DemoCard>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-xl font-bold mb-4">Form Section</h2>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Password</label>
                    <input
                      type="password"
                      className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="flex gap-2">
                    <DemoButton variant="primary" />
                    <DemoButton variant="secondary" />
                  </div>
                </div>
              </div>
            </div>
          </AutoInspector>

          {/* Alternative: Using explicit Inspectable wrappers */}
          <div className="mt-8 border-t border-gray-800 pt-8">
            <h2 className="text-xl font-bold mb-4">Explicit Inspectable Wrappers</h2>
            <p className="text-gray-400 mb-4">
              These use the <code className="bg-gray-800 px-1 rounded">{"<Inspectable>"}</code> wrapper for more control.
            </p>
            <div className="flex gap-4">
              <Inspectable id="explicit-box-1">
                <div className="bg-purple-900 border border-purple-700 p-4 rounded-lg">
                  Explicitly wrapped #1
                </div>
              </Inspectable>
              <Inspectable id="explicit-box-2">
                <div className="bg-green-900 border border-green-700 p-4 rounded-lg">
                  Explicitly wrapped #2
                </div>
              </Inspectable>
            </div>
          </div>
        </div>
      </div>
    </InspectorProvider>
  );
}
