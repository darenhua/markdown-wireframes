"use client";

import { useCallback, useState } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";

// Define the path structure for the state machine
interface PathNode {
  id: string;
  path: string;
  label: string;
  connections: string[]; // IDs of connected nodes
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
function PathNodeComponent({ data, selected }: NodeProps) {
  const isActive = data.isActive as boolean;

  return (
    <div
      className={cn(
        "px-4 py-2 rounded-lg border-2 shadow-md min-w-[100px] text-center cursor-pointer transition-all",
        isActive
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-card-foreground border-border hover:border-primary/50",
        selected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="font-medium">{data.label as string}</div>
      <div className="text-xs opacity-70 mt-1">{data.path as string}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = {
  pathNode: PathNodeComponent,
};

// Generate nodes and edges from path config
function generateGraph(
  config: PathNode[],
  activePath: string
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = config.map((node, index) => ({
    id: node.id,
    type: "pathNode",
    position: {
      x: (index % 3) * 200 + 50,
      y: Math.floor(index / 3) * 120 + 50,
    },
    data: {
      label: node.label,
      path: node.path,
      isActive: node.path === activePath,
    },
  }));

  const edges: Edge[] = [];
  const addedEdges = new Set<string>();

  for (const node of config) {
    for (const targetId of node.connections) {
      const edgeId = [node.id, targetId].sort().join("-");
      if (!addedEdges.has(edgeId)) {
        addedEdges.add(edgeId);
        edges.push({
          id: edgeId,
          source: node.id,
          target: targetId,
          type: "smoothstep",
          animated: node.path === activePath || config.find(n => n.id === targetId)?.path === activePath,
          style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 2 },
        });
      }
    }
  }

  return { nodes, edges };
}

export default function IframePortalPage() {
  const [currentPath, setCurrentPath] = useState("/");
  const baseUrl = "http://localhost:3030";
  const fullUrl = `${baseUrl}${currentPath}`;

  const { nodes: initialNodes, edges: initialEdges } = generateGraph(
    pathConfig,
    currentPath
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const path = node.data.path as string;
      setCurrentPath(path);

      // Update nodes and edges to reflect new active state
      const { nodes: newNodes, edges: newEdges } = generateGraph(
        pathConfig,
        path
      );
      setNodes(newNodes);
      setEdges(newEdges);
    },
    [setNodes, setEdges]
  );

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Graph Panel */}
      <div className="w-1/3 border-r bg-muted/30">
        <div className="p-4 border-b bg-background">
          <h2 className="font-semibold text-lg">Navigation Graph</h2>
          <p className="text-sm text-muted-foreground">
            Click a node to navigate
          </p>
        </div>
        <div className="h-[calc(100%-73px)]">
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
