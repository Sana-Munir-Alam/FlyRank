"use client";

import { Handle, Position, useReactFlow, type NodeProps, type Node, } from "@xyflow/react";

type DecisionNodeData = {
  prompt: string;
};

type DecisionNodeType = Node<DecisionNodeData, "decisionNode">;


export default function DecisionNode({ id, data, }: NodeProps<DecisionNodeType>) {
    const { updateNodeData } = useReactFlow();
    return (

        <div className="w-72 rounded-lg border bg-background p-4 shadow-md">
            <Handle type="target" position={Position.Top} />
            <div className="mb-2 text-sm font-semibold">AI Decision</div>

            <textarea
                value={data.prompt ?? ""}
                onChange={(event) => {
                    updateNodeData(id, { prompt: event.target.value, });
                }}
                className="nodrag w-full resize-none rounded-md border bg-background p-2 text-sm outline-none"
                rows={3}
                placeholder="Enter your decision prompt..."
            />

            {/* Handle for the "yes" decision and "no decision" */}
            <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "30%", background: "green", }}/>
            <Handle type="source" position={Position.Bottom} id="no" style={{ left: "70%", background: "red", }} />

            <div className="mt-3 flex justify-between text-xs font-medium">
                <span className="absolute -translate-x-1/2" style={{ left: "30%" }}>YES</span>
                <span className="absolute -translate-x-1/2" style={{ left: "70%" }}>NO</span>
            </div>
        </div>
    );
}