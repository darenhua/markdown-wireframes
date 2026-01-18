"use client";

import { useCallback, useState, useMemo } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type NodeProps,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

// Define the path structure for the state machine
interface PathNode {
  id: string;
  path: string;
  label: string;
  connections: string[]; // IDs of connected nodes (neighbors)
}

// Sample path configuration - you can customize this
const pathConfig: PathNode[] = [
  { id: "home", path: "/", label: "Home", connections: ["about", "products"] },
  {
    id: "about",
    path: "/about",
    label: "About",
    connections: ["home", "team"],
  },
  {
    id: "products",
    path: "/products",
    label: "Products",
    connections: ["home", "product-detail"],
  },
  { id: "team", path: "/team", label: "Team", connections: ["about"] },
  {
    id: "product-detail",
    path: "/products/1",
    label: "Product Detail",
    connections: ["products", "cart"],
  },
  {
    id: "cart",
    path: "/cart",
    label: "Cart",
    connections: ["product-detail", "checkout"],
  },
  { id: "checkout", path: "/checkout", label: "Checkout", connections: ["cart", "home"] },
];

// Custom node component
function PathNodeComponent({ data }: NodeProps) {
  const isActive = data.isActive as boolean;
  const isNeighbor = data.isNeighbor as boolean;
  const isDisabled = !isActive && !isNeighbor;

  return (
    <div
      className={cn(
        "px-4 py-2 rounded-lg border-2 shadow-md min-w-[100px] text-center transition-all",
        isActive && "bg-primary text-primary-foreground border-primary scale-110",
        isNeighbor && !isActive && "bg-green-500/20 text-foreground border-green-500 cursor-pointer hover:bg-green-500/30 hover:scale-105",
        isDisabled && "bg-muted/50 text-muted-foreground border-muted cursor-not-allowed opacity-50"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />
      <div className="font-medium text-sm">{data.label as string}</div>
      <div className="text-xs opacity-70 mt-0.5">{data.path as string}</div>
      {isNeighbor && !isActive && (
        <div className="text-[10px] text-green-600 mt-1 font-medium">Click to navigate</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-2" />
    </div>
  );
}

const nodeTypes = {
  pathNode: PathNodeComponent,
};

// Get neighbors for a given node ID
function getNeighbors(nodeId: string): Set<string> {
  const node = pathConfig.find((n) => n.id === nodeId);
  return new Set(node?.connections || []);
}

// Generate nodes and edges from path config
function generateGraph(
  config: PathNode[],
  activeNodeId: string
): { nodes: Node[]; edges: Edge[] } {
  const neighbors = getNeighbors(activeNodeId);

  const nodes: Node[] = config.map((node, index) => ({
    id: node.id,
    type: "pathNode",
    position: {
      x: (index % 3) * 220 + 50,
      y: Math.floor(index / 3) * 140 + 50,
    },
    data: {
      label: node.label,
      path: node.path,
      isActive: node.id === activeNodeId,
      isNeighbor: neighbors.has(node.id),
    },
  }));

  const edges: Edge[] = [];
  const addedEdges = new Set<string>();

  for (const node of config) {
    for (const targetId of node.connections) {
      const edgeId = [node.id, targetId].sort().join("-");
      if (!addedEdges.has(edgeId)) {
        addedEdges.add(edgeId);

        // Check if this edge connects to the active node
        const isActiveEdge = node.id === activeNodeId || targetId === activeNodeId;

        edges.push({
          id: edgeId,
          source: node.id,
          target: targetId,
          type: "smoothstep",
          animated: isActiveEdge,
          style: {
            stroke: isActiveEdge ? "hsl(142, 76%, 36%)" : "hsl(var(--muted-foreground))",
            strokeWidth: isActiveEdge ? 3 : 2,
            opacity: isActiveEdge ? 1 : 0.4,
          },
          markerEnd: isActiveEdge ? {
            type: MarkerType.ArrowClosed,
            color: "hsl(142, 76%, 36%)",
          } : undefined,
        });
      }
    }
  }

  return { nodes, edges };
}

export default function IframePortalPage() {
  const [activeNodeId, setActiveNodeId] = useState("home");
  const baseUrl = "http://localhost:3030";

  // Get current path from active node
  const currentPath = useMemo(() => {
    return pathConfig.find((n) => n.id === activeNodeId)?.path || "/";
  }, [activeNodeId]);

  const fullUrl = `${baseUrl}${currentPath}`;

  // Get current neighbors
  const currentNeighbors = useMemo(() => getNeighbors(activeNodeId), [activeNodeId]);

  const { nodes: initialNodes, edges: initialEdges } = generateGraph(
    pathConfig,
    activeNodeId
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // Only allow navigation to neighbors
      if (!currentNeighbors.has(node.id) && node.id !== activeNodeId) {
        return; // Ignore clicks on non-neighbor nodes
      }

      // Don't do anything if clicking the already active node
      if (node.id === activeNodeId) {
        return;
      }

      setActiveNodeId(node.id);

      // Update nodes and edges to reflect new active state
      const { nodes: newNodes, edges: newEdges } = generateGraph(
        pathConfig,
        node.id
      );
      setNodes(newNodes);
      setEdges(newEdges);
    },
    [activeNodeId, currentNeighbors, setNodes, setEdges]
  );

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Graph Panel */}
      <div className="w-1/3 border-r bg-muted/30">
        <div className="p-4 border-b bg-background">
          <h2 className="font-semibold text-lg">Navigation Graph</h2>
          <p className="text-sm text-muted-foreground">
            Click green neighbors to navigate
          </p>
          <div className="flex gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-primary" /> Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500/50 border border-green-500" /> Navigable
            </span>
          </div>
        </div>
        <div className="h-[calc(100%-105px)]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Iframe Panel */}
      <div className="flex-1 flex flex-col">
        {/* URL Bar */}
        <div className="p-4 border-b bg-background flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border">
            <svg
              className="w-4 h-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <span className="text-sm font-mono">{fullUrl}</span>
          </div>
          <button
            onClick={() => {
              const iframe = document.querySelector("iframe");
              if (iframe) {
                iframe.src = iframe.src;
              }
            }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Refresh"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Iframe Container */}
        <div className="flex-1 bg-white">
          <iframe
            src={fullUrl}
            className="w-full h-full border-0"
            title="Portal Content"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  );
}
