import type { Edge, Node } from "@xyflow/react";

export type DecisionNodeData = {prompt: string;};

export type SavedFlow = {
    version: 1;
    nodes: Array<Node<DecisionNodeData>>;
    edges: Array<Edge>;
};

const STORAGE_KEY = "ai-decision-flow";

export function saveFlow( nodes: Array<Node<DecisionNodeData>>, edges: Array<Edge>): void {
    const flow: SavedFlow = {
    version: 1,
        nodes,
        edges,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flow));
}

export function loadFlow(): SavedFlow | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { return null; }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("Saved workflow contains invalid JSON.");
    }
    return validateFlow(parsed);
}

export function exportFlow( nodes: Array<Node<DecisionNodeData>>, edges: Array<Edge> ): void {
    const flow: SavedFlow = {
        version: 1,
        nodes,
        edges,
    };

    const blob = new Blob( [JSON.stringify(flow, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "decision-flow.json";
    link.click();

    URL.revokeObjectURL(url);
}

export function importFlow(file: File): Promise<SavedFlow> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result));
        resolve(validateFlow(parsed));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Could not import workflow."));
      }
    };
    reader.onerror = () => { reject(new Error("Could not read workflow file."));};
    reader.readAsText(file);
  });
}

function validateFlow(value: unknown): SavedFlow {
    if (!value || typeof value !== "object") {
        throw new Error("Workflow must be a JSON object.");
    }
    const data = value as Record<string, unknown>;

    if (data.version !== 1) {
        throw new Error("Unsupported workflow version.");
    }

    if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
        throw new Error("Workflow must contain at least one node.");
    }

    if (!Array.isArray(data.edges)) {
        throw new Error("Workflow edges must be an array.");
    }

    const nodeIds = new Set<string>();

    for (const node of data.nodes) {
        if (!node || typeof node !== "object") {
        throw new Error("Workflow contains an invalid node.");
        }

        const n = node as Record<string, unknown>;

        if (typeof n.id !== "string" || !n.id.trim()) {
        throw new Error("Every node must have a valid ID.");
        }

        if (nodeIds.has(n.id)) {
        throw new Error(`Duplicate node ID: ${n.id}`);
        }

        nodeIds.add(n.id);

        if (!n.data || typeof n.data !== "object") {
        throw new Error(`Node ${n.id} has invalid data.`);
        }

        const nodeData = n.data as Record<string, unknown>;

        if (typeof nodeData.prompt !== "string") {
        throw new Error(`Node ${n.id} has an invalid prompt.`);
        }
    }

    const incomingNodes = new Set<string>();
    const branches = new Set<string>();

    for (const edge of data.edges) {
        if (!edge || typeof edge !== "object") {
        throw new Error("Workflow contains an invalid edge.");
        }

        const e = edge as Record<string, unknown>;

        if ( typeof e.id !== "string" || typeof e.source !== "string" || typeof e.target !== "string") {
        throw new Error("Every edge must have an ID, source, and target.");
        }

        if (e.sourceHandle !== "yes" && e.sourceHandle !== "no") {
        throw new Error(`Edge ${e.id} must use a YES or NO source handle.`);
        }

        if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) {
        throw new Error(`Edge ${e.id} references a node that does not exist.`);
        }

        if (e.source === e.target) {
        throw new Error(`Edge ${e.id} cannot connect a node to itself.`);
        }

        if (incomingNodes.has(e.target)) {
        throw new Error(`Node ${e.target} has more than one incoming edge.`);
        }

        incomingNodes.add(e.target);
        const branchKey = `${e.source}:${e.sourceHandle}`;
        if (branches.has(branchKey)) {
        throw new Error(`Node ${e.source} has more than one ${String(e.sourceHandle).toUpperCase()} edge.`);
        }

        branches.add(branchKey);
    }

    const rootNodes = (data.nodes as Array<Record<string, unknown>>).filter(
        (node) => !incomingNodes.has(node.id as string)
    );

    if (rootNodes.length !== 1) {
        throw new Error(`Workflow must have exactly one start node, but found ${rootNodes.length}.`);
    }

    return {
        version: 1,
        nodes: data.nodes as Array<Node<DecisionNodeData>>,
        edges: data.edges as Array<Edge>,
    };
}