"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addEdge, Background, Controls, ReactFlow, useEdgesState, useNodesState, type Connection, type Edge, type Node,} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import DecisionNode from "@/components/flow/DecisionNode";
import YesEdge from "@/components/flow/YesEdge";
import NoEdge from "@/components/flow/NoEdge";
import type { RunState } from "@/lib/runStore";
import LogsPanel from "@/components/flow/LogsPanel";
import { saveFlow, loadFlow, exportFlow, importFlow,} from "@/lib/flowStorage";

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
  const [runState, setRunState] = useState<RunState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollRun = useCallback((runId: string) => {
    stopPolling();

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/runs/${runId}`);
      if (!res.ok) {
        stopPolling();
        return;
      }
      const data: RunState = await res.json();
      setRunState(data);
      if (data.status === "completed" || data.status === "failed" || data.status === "cancelled") {
        stopPolling();
      }
    }, 1000);

  }, [stopPolling]);

  useEffect(() => stopPolling, [stopPolling]); // clear interval on unmount

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
      const targetAlreadyHasParent = currentEdges.some( (edge) => edge.target === target);
      if (branchAlreadyConnected || targetAlreadyHasParent) { return currentEdges; }
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
      alert("No start node found every node has an incoming edge. A workflow must have exactly one start node.");
      return;
    }

    if (rootCandidates.length > 1) {
      alert(`Workflow must have exactly one start node, but found ${rootCandidates.length}. Connect the separate trees into one workflow or delete the extra tree.`);
      return;
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
    setRunState(null);
    pollRun(runId);
  }, [nodes, edges, pollRun]);

  const displayEdges = useMemo(() => {
    if (!runState) return edges;
    return edges.map((edge) => {
      const sourceNode = runState.nodes[edge.source];
      const traversed = sourceNode?.decision?.toLowerCase() === edge.sourceHandle;
      return { ...edge, animated: traversed };
    });
  }, [edges, runState]);

  const handleSave = useCallback(() => {
    try {
      saveFlow(nodes, edges);
      alert("Workflow saved.");
    } catch (error) {
      alert( error instanceof Error ? error.message : "Could not save workflow." );
    }
  }, [nodes, edges]);

  const handleLoad = useCallback(() => {
    try {
      const flow = loadFlow(); 
      if (!flow) {
        alert("No saved workflow found.");
        return;
      }
      setNodes(flow.nodes as DecisionNodeType[]);
      setEdges(flow.edges as AppEdge[]); 
      alert("Workflow loaded.");

    } catch (error) {
      alert(error instanceof Error ? error.message : "Could not load workflow.");
    }
  }, [setNodes, setEdges]);

  const handleExport = useCallback(() => {
    try {
      exportFlow(nodes, edges);
    } catch (error) {
      alert( error instanceof Error ? error.message : "Could not export workflow." );
    }
  }, [nodes, edges]);

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) { return; }

      try {
        const flow = await importFlow(file);
        setNodes(flow.nodes as DecisionNodeType[]);
        setEdges(flow.edges as AppEdge[]);
        alert("Workflow imported.");
      } catch (error) {
        alert( error instanceof Error ? error.message : "Could not import workflow." );
      } finally {
        event.target.value = "";  // is useful because it lets you import the same file again after fixing/retrying it.
      }
    },
    [setNodes, setEdges]
  );

  return (
    <main className="h-screen w-screen">
      <div className="absolute left-4 top-4 z-10 flex gap-2">
        <button type="button" onClick={addDecisionNode} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow">
          Add Decision Node
        </button>

        <button type="button" onClick={runFlow} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow">
          Run Flow
        </button>

        <button type="button" onClick={handleSave}className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow">
          Save
        </button>

        <button type="button" onClick={handleLoad} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow">
          Load
        </button>

        <button type="button" onClick={handleExport} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow">
          Export
        </button>

        <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-md border bg-background px-4 py-2 text-sm font-medium shadow">
          Import
        </button>

        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImport}className="hidden"/>
      </div>

      <ReactFlow<DecisionNodeType, AppEdge>
        nodes={nodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <LogsPanel runState={runState} />
        <Background />
        <Controls />
      </ReactFlow>
    </main>
  );
}