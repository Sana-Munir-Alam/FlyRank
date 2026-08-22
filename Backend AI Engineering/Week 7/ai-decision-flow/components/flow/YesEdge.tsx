"use client";

import { BaseEdge, getBezierPath, type Edge, type EdgeProps,} from "@xyflow/react";

type YesEdgeType = Edge<{}, "yesEdge">;

export default function YesEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, }: EdgeProps<YesEdgeType>) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: "green", strokeWidth: 2, }}
    />
  );
}