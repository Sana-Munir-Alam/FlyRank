"use client";

import type { RunState, NodeStatus } from "@/lib/runStore";

const NODE_STATUS_COLORS: Record<NodeStatus, string> = {
  pending: "bg-gray-200 text-gray-700",
  running: "bg-blue-200 text-blue-800",
  completed: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
  skipped: "bg-yellow-100 text-yellow-700",
};

const RUN_STATUS_COLORS: Record<RunState["status"], string> = {
  pending: "bg-gray-200 text-gray-700",
  running: "bg-blue-200 text-blue-800",
  completed: "bg-green-200 text-green-800",
  failed: "bg-red-200 text-red-800",
  cancelled: "bg-yellow-100 text-yellow-700",
};

export default function LogsPanel({ runState }: { runState: RunState | null }) {
  if (!runState) return null;

  return (
    <div className="absolute right-4 top-4 z-10 w-80 max-h-[80vh] overflow-y-auto rounded-lg border bg-background p-3 shadow-lg text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Run status</span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${RUN_STATUS_COLORS[runState.status]}`}>
          {runState.status}
        </span>
      </div>

      {runState.error && (
        <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700">
          {runState.error.nodeId ? `Node ${runState.error.nodeId}: ` : ""}
          {runState.error.message}
        </div>
      )}

      <ul className="space-y-1">
        {Object.entries(runState.nodes).map(([nodeId, node]) => (
          <li key={nodeId} className="flex items-center justify-between rounded border p-1.5">
            <span className="truncate font-mono text-xs">{nodeId}</span>
            <div className="flex items-center gap-1">
              {node.decision && <span className="text-xs text-muted-foreground">{node.decision}</span>}
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${NODE_STATUS_COLORS[node.status]}`}>
                {node.status}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}