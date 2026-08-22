"use client";

import { BaseEdge, getBezierPath, type Edge, type EdgeProps,} from "@xyflow/react";

type NoEdgeType = Edge<{}, "noEdge">;

export default function NoEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, }: EdgeProps<NoEdgeType>) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: "red", strokeWidth: 2, }}
    />
  );
}