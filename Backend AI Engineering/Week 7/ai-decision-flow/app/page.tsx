"use client";

import { addEdge, Background, Controls, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node,} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DecisionNode from "@/components/flow/DecisionNode";
import YesEdge from "@/components/flow/YesEdge";
import NoEdge from "@/components/flow/NoEdge";
import { useCallback } from "react";

type DecisionNodeData = {
  prompt: string;
};

type DecisionNodeType = Node< DecisionNodeData, "decisionNode" >;
type YesEdgeType = Edge< {}, "yesEdge" >;
type NoEdgeType = Edge< {}, "noEdge" >
type AppEdge = YesEdgeType | NoEdgeType;

const nodeTypes = {
  decisionNode: DecisionNode,
};

const edgeTypes = {
  yesEdge: YesEdge,
  noEdge: NoEdge,
};

// Initial nodes and edges for the flowchart
const initialNodes: DecisionNodeType[] = [
  {
    id: "node-1",
    type: "decisionNode",
    position: {
      x: 300,
      y: 100,
    },
    data: {
      prompt: "Is this a support request?",
    },
  },
];

// Initial edges for the flowchart
const initialEdges: AppEdge[] = [];

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState<DecisionNodeType>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AppEdge>(initialEdges);

  const onConnect = useCallback((connection: Connection) => {
    const { source, target, sourceHandle } = connection;

    // A decision edge must originate from either the YES or NO handle.
    if ( !source || !target || (sourceHandle !== "yes" && sourceHandle !== "no")) { return; }
    const edgeType = sourceHandle === "yes" ? "yesEdge" : "noEdge";
    const newEdge: AppEdge = {
      id: `${source}-${sourceHandle}-${target}`,
      source,
      target,
      sourceHandle,
      type: edgeType,
    };
    setEdges((currentEdges) => {
      const branchAlreadyConnected = currentEdges.some(
        (edge) => edge.source === source && edge.sourceHandle === sourceHandle
      );
      if (branchAlreadyConnected) { return currentEdges; }
      return addEdge(newEdge, currentEdges);
    });
  }, [setEdges]);

  const addDecisionNode = useCallback(() => {
    const newNode: DecisionNodeType = {
      id: `node-${Date.now()}`,
      type: "decisionNode",
      position: {
        x: 100 + Math.random() * 500,
        y: 100 + Math.random() * 400,
      },
      data: {
        prompt: "",
      },
    };
    setNodes((currentNodes) => [ ...currentNodes, newNode, ]);
  }, [setNodes]); 

  return (
    <main className="h-screen w-screen">
      <div className="absolute left-4 top-4 z-10">
        <button type="button" onClick={addDecisionNode} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow" >
          Add Decision Node
        </button>
      </div>

      <ReactFlow<DecisionNodeType, AppEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </main>
  );
}