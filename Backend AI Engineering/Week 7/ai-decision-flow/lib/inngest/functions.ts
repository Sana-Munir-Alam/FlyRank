import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import { getDecision } from "@/lib/gemini";
import { initializeRun, startRun, setNodeStatus, completeNode, failNode, skipNode, completeRun, failRun, failRunWithoutNode,} from "@/lib/runStore";

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
    initializeRun(runId, nodes);
    startRun(runId);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const visited = new Set<string>();
    const executionOrder: Array<{ nodeId: string; prompt: string; decision: "YES" | "NO" }> = [];

    // Marks every node reachable from the given node as skipped.
    // This handles nested branches. If C is skipped because its parent selected the other branch, then C's children are also unreachable and should be skipped immediately.
    const skipSubtree = (rootNodeId: string) => {
        const queue: string[] = [rootNodeId];
        const skipped = new Set<string>();

        while (queue.length > 0) {
            const nodeId = queue.shift()!;
            if (skipped.has(nodeId)) { continue; }
            
            skipped.add(nodeId);
            const node = nodeById.get(nodeId);
            if (!node) { continue; }

            skipNode(runId, nodeId);
            const childEdges = edges.filter( (edge) => edge.source === nodeId, );
            for (const edge of childEdges) {
                queue.push(edge.target);
            }
        }
    };

    let currentNodeId: string | null = startNodeId;

    try {
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

            setNodeStatus(runId, currentNodeId, "running");
            let decision: "YES" | "NO";

            try {
                decision = await step.run(`decide-${currentNodeId}`, async (): Promise<"YES" | "NO"> => {
                    try {
                        return await getDecision(node.data.prompt);
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : undefined;
                        const isPermanentAuthError = status === 400 || status === 401 || status === 403 || message.includes("Invalid Auth key");
                        if (isPermanentAuthError) {
                            throw new NonRetriableError(`Permanent model error: ${message}`);
                        }
                        throw error;
                    }
                });
            } catch (error) {
                // This only runs once step.run has FULLY given up either it hit NonRetriableError on attempt 1, or it retried and ran out of attempts.  Nothing here decides retry behavior anymore. It just records the final outcome.
                const message = error instanceof Error ? error.message : String(error);
                failNode(runId, currentNodeId, message);
                throw error;
            }

            completeNode( runId, currentNodeId, decision, );
            executionOrder.push({ nodeId: currentNodeId, prompt: node.data.prompt, decision });

            const selectedHandle: "yes" | "no" = decision === "YES" ? "yes" : "no";
            const nextEdge: FlowEdge | undefined = edges.find(
                (edge: FlowEdge) => edge.source === currentNodeId && edge.sourceHandle === selectedHandle,
            );

            const skippedHandle: "yes" | "no" = decision === "YES" ? "no" : "yes";
            const skippedEdge: FlowEdge | undefined = edges.find(
                (edge: FlowEdge) => edge.source === currentNodeId && edge.sourceHandle === skippedHandle,
            );

            if (skippedEdge) { skipSubtree(skippedEdge.target); }
            currentNodeId = nextEdge ? nextEdge.target : null; 
        }
        completeRun(runId);
        return { runId, executionOrder, };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failedNodeId = currentNodeId && nodeById.has(currentNodeId) ? currentNodeId : null;

        if (failedNodeId) {
            failRun( runId, failedNodeId, message, );
        } else {
            failRunWithoutNode( runId, message, );
        }
        throw error;
    }
  }
);