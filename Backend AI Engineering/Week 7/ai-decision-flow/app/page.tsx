"use client";

import { useCallback } from "react";
import { addEdge, Background, Controls, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node,} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DecisionNode from "@/components/flow/DecisionNode";
import YesEdge from "@/components/flow/YesEdge";
import NoEdge from "@/components/flow/NoEdge";

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
    if ( !source || !target || (sourceHandle !== "yes" && sourceHandle !== "no") || source === target) { return; }
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

  const runFlow = useCallback(async () => {
    const rootCandidates = nodes.filter((node) => !edges.some((edge) => edge.target === node.id));
    if (rootCandidates.length === 0) {
      alert("No start node found — every node has an incoming edge. Pick a starting point.");
      return;
    }
    if (rootCandidates.length > 1) {
      alert( `Multiple possible start nodes found (${rootCandidates.map((n) => n.id).join(", ")}). Using the first one for now — Stage 4 should let you pick explicitly.`);
    }

    const emptyPromptNode = nodes.find((node) => !node.data.prompt.trim());
    if (emptyPromptNode) {
      alert(`Node ${emptyPromptNode.id} has an empty prompt.`);
      return;
    }

    const startNodeId = rootCandidates[0].id;
    const response = await fetch("/api/trigger-flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startNodeId,
        nodes: nodes.map((n) => ({ id: n.id, data: { prompt: n.data.prompt } })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
        })),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      alert(`Could not start run: ${err.error}`);
      return;
    }

    const { runId } = await response.json();
    alert(`Run started: ${runId}. Check the Inngest dev server (localhost:8288) to watch it.`);
  }, [nodes, edges]);

  return (
    <main className="h-screen w-screen">
      <div className="absolute left-4 top-4 z-10">
        <button type="button" onClick={addDecisionNode} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow" >
          Add Decision Node
        </button>
         <button type="button" onClick={runFlow} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow">
          Run Flow
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