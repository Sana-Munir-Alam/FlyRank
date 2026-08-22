import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { getDecision } from "@/lib/openai";

type FlowNode = { id: string; data: { prompt: string } };
type FlowEdge = { id: string; source: string; target: string; sourceHandle: "yes" | "no" };

type FlowRunEventData = {
  runId: string;
  startNodeId: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export const runDecisionFlow = inngest.createFunction({ id: "run-decision-flow", retries: 2, triggers: { event: "flow/run" }}, 
async ({ event, step }) => {
    const { nodes, edges, startNodeId, runId } = event.data as FlowRunEventData;
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const visited = new Set<string>();
    const executionOrder: Array<{ nodeId: string; prompt: string; decision: "YES" | "NO" }> = [];

    let currentNodeId: string | null = startNodeId;

    while (currentNodeId !== null) {
        if (visited.has(currentNodeId)) {
            // NonRetriableError tells Inngest: don't retry the whole function, this isn't a transient failure, the graph itself is broken.
            throw new NonRetriableError( `Cycle detected: node ${currentNodeId} was reached twice in run ${runId}.` );
        }
        visited.add(currentNodeId);

        const node = nodeById.get(currentNodeId);
        if (!node) {
            throw new NonRetriableError( `Node ${currentNodeId} is referenced by an edge but does not exist in this run's node list.`);
        }

        // Each node's model call is its own named step. If node 3 fails after  nodes 1 and 2 already succeeded, Inngest replays the function but  skips re-running steps 1 and 2 — it uses their already-recorded results. Without step.run, a crash on node 3 would silently  re-call the model for nodes 1 and 2 too: extra cost, extra latency, and a different possible answer each time since the model is non-deterministic.
        const decision: "YES" | "NO" = await step.run(`decide-${currentNodeId}`,
            async (): Promise<"YES" | "NO"> => { return getDecision(node.data.prompt); }
        );

        executionOrder.push({ nodeId: currentNodeId, prompt: node.data.prompt, decision });

        const nextEdge: FlowEdge | undefined = edges.find(
            (edge) => edge.source === currentNodeId && edge.sourceHandle === decision.toLowerCase()
        );

        // No matching edge means this node has no wired branch for the  decision it just made — a legitimate terminal state (leaf node), not an error. Traversal ends here.
        currentNodeId = nextEdge ? nextEdge.target : null;
        }

        return { runId, executionOrder };
  }
);