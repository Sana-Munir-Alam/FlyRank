export const NODE_STATUSES = ["pending", "running", "completed", "failed", "skipped",] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];
export const RUN_STATUSES = ["pending", "running", "completed", "failed", "cancelled",] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];
export type Decision = "YES" | "NO";
export type RunError = { nodeId: string | null; message: string;};

export type NodeRunState = {
    status: NodeStatus;
    decision?: Decision;
    error?: string;
    startedAt?: string;
    endedAt?: string;
};

export type RunState = {
    runId: string;
    status: RunStatus;
    startedAt: string | null;
    endedAt: string | null;
    error: RunError | null;
    nodes: Record<string, NodeRunState>;
};

type RunNode = {
    id: string;
};

const runs = new Map<string, RunState>();

// Creates a new run with every node initially marked as pending. The run itself starts as pending and can then be moved to running  with startRun().
export function initializeRun( runId: string, nodes: RunNode[],): RunState {
    if (runs.has(runId)) {
        return getRun(runId)!;
    }

    const nodeStates: Record<string, NodeRunState> = {};
    for (const node of nodes) {
        nodeStates[node.id] = { status: "pending", };
    }

    const run: RunState = {
        runId,
        status: "pending",
        startedAt: null,
        endedAt: null,
        error: null,
        nodes: nodeStates,
    };
    runs.set(runId, run);
    return getRun(runId)!;
}

// Marks a run as running.
export function startRun(runId: string): RunState {
    const run = getExistingRun(runId);

    if (run.status === "pending") {
        run.status = "running";
        run.startedAt = new Date().toISOString();
    }

    return getRun(runId)!;
}

// Updates one node's current state.
// This intentionally overwrites the existing state instead of appending another status entry. That makes the operation idempotent and safe if Inngest replays the function.
export function setNodeStatus( runId: string, nodeId: string, status: NodeStatus, options?: { decision?: Decision; error?: string;},): RunState {
    const run = getExistingRun(runId);
    const node = run.nodes[nodeId];

    if (!node) {
        throw new Error( `Node ${nodeId} does not exist in run ${runId}.`, );
    }

    node.status = status;
    if (options?.decision !== undefined) { node.decision = options.decision; }
    if (options?.error !== undefined) { node.error = options.error; }
    if (status === "running" && !node.startedAt) { node.startedAt = new Date().toISOString(); }
    if ((status === "completed" || status === "failed" || status === "skipped") && !node.endedAt) { node.endedAt = new Date().toISOString(); }
    return getRun(runId)!;
}

// Marks a node as skipped immediately.
// This is intentionally a separate method so functions.ts can mark the unselected sibling branch as soon as the parent's decision becomes known.
export function skipNode( runId: string, nodeId: string, ): RunState {
  return setNodeStatus(runId, nodeId, "skipped");
}

// Marks a node as completed with its final YES/NO decision.
export function completeNode( runId: string, nodeId: string, decision: Decision,): RunState {
  return setNodeStatus( runId, nodeId, "completed", { decision }, );
}

// Marks a node as failed with its error message.
export function failNode( runId: string, nodeId: string, message: string,): RunState {
  return setNodeStatus( runId, nodeId, "failed", { error: message },);
}

// Marks the entire run as successfully completed. 
export function completeRun(runId: string): RunState {
    const run = getExistingRun(runId);
    run.status = "completed";
    if (!run.endedAt) { run.endedAt = new Date().toISOString(); }
    run.error = null;
    return getRun(runId)!;
}

// Marks the entire run as failed. The error keeps both the node that failed and the actual message.
export function failRun( runId: string, nodeId: string, message: string,): RunState {
    const run = getExistingRun(runId);
    run.status = "failed";
    if (!run.endedAt) { run.endedAt = new Date().toISOString(); }
    run.error = { nodeId, message, };
    return getRun(runId)!;
}

// Marks the entire run as cancelled.
export function cancelRun(runId: string): RunState {
    const run = getExistingRun(runId);
    run.status = "cancelled";
    if (!run.endedAt) { run.endedAt = new Date().toISOString(); }
    return getRun(runId)!;
}

// Returns the current state of a run.  A copy is returned so callers cannot accidentally mutate the  store without going through the store functions.
export function getRun(runId: string): RunState | null {
    const run = runs.get(runId);
    if (!run) { return null;}
    return structuredClone(run);
}

// Returns all currently stored runs. This is useful later for an execution history panel.
export function getAllRuns(): RunState[] {
    return Array.from(runs.values()).map((run) => structuredClone(run),);
}

// Internal helper used by mutation functions. used to ensure a run exists before mutating it. Throws if the run does not exist.
function getExistingRun(runId: string): RunState {
    const run = runs.get(runId);
    if (!run) {
        throw new Error(`Run ${runId} does not exist.`,);
    }
    return run;
}

// Marks the entire run as failed without a specific node. This is used when the run fails before any node is reached, e.g., if the workflow graph itself is invalid.
export function failRunWithoutNode( runId: string, message: string,): RunState {
    const run = getExistingRun(runId);
    run.status = "failed";
    if (!run.endedAt) { run.endedAt = new Date().toISOString(); }
    run.error = { nodeId: null,  message, };

    return getRun(runId)!;
}