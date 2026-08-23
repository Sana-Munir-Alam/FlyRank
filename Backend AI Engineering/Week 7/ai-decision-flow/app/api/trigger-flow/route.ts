import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { inngest } from "@/lib/inngest/client";

type TriggerFlowBody = {
  startNodeId: string;
  nodes: Array<{ id: string; data: { prompt: string } }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle: "yes" | "no" }>;
};

function isValidTriggerBody( body: unknown ): body is TriggerFlowBody {
    if (!body || typeof body !== "object") return false;
    const value = body as Record<string, unknown>;

    if (typeof value.startNodeId !== "string" || !value.startNodeId.trim()) return false;
    if (!Array.isArray(value.nodes) || value.nodes.length === 0) return false;
    if (!Array.isArray(value.edges)) return false;

    for (const node of value.nodes) {
        if (!node || typeof node !== "object") return false;
        const nodeValue = node as Record<string, unknown>;

        if (typeof nodeValue.id !== "string") return false;
        if ( !nodeValue.data || typeof nodeValue.data !== "object" ) return false;

        const data = nodeValue.data as Record< string, unknown>;
        if (typeof data.prompt !== "string") return false; 
        if (!data.prompt.trim()) return false;
    }

    for (const edge of value.edges) {
        if (!edge || typeof edge !== "object") return false;
        const edgeValue = edge as Record<string, unknown>;

        if (typeof edgeValue.id !== "string" || typeof edgeValue.source !== "string" || typeof edgeValue.target !== "string") return false;
        if (edgeValue.sourceHandle !== "yes" && edgeValue.sourceHandle !== "no") return false;
    }
  return true;
}

export async function POST(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Request body must contain valid JSON.", }, { status: 400 });
    }

    if (!isValidTriggerBody(body)) {
        return NextResponse.json({ error: "Invalid workflow payload.", }, { status: 400 });
    }

    const nodeIds = new Set(body.nodes.map((node) => node.id));

    if (!nodeIds.has(body.startNodeId)) {
        return NextResponse.json({ error: "startNodeId does not reference an existing node.", }, { status: 400 });
    }

    const duplicateNodeIds = body.nodes.some(
        (node, index) => body.nodes.findIndex((candidate) => candidate.id === node.id) !== index
    );

    if (duplicateNodeIds) {
        return NextResponse.json({error: "Workflow contains duplicate node IDs.",}, { status: 400 });
    }

    const incomingEdges = new Set<string>();
    for (const edge of body.edges) {
        if (incomingEdges.has(edge.target)) {
            return NextResponse.json( { error: `Node ${edge.target} has more than one incoming edge.`, }, { status: 400 } );
        }
        incomingEdges.add(edge.target);
    }

    const rootNodes = body.nodes.filter( (node) => !incomingEdges.has(node.id));

    if (rootNodes.length !== 1) {
        return NextResponse.json({ error: `Workflow must have exactly one start node, but found ${rootNodes.length}.`, }, { status: 400 });
    }

    if (rootNodes[0].id !== body.startNodeId) {
        return NextResponse.json({ error: `startNodeId must be the workflow's only root node.`, }, { status: 400 });
    }

    for (const edge of body.edges) {
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
            return NextResponse.json({ error: `Edge ${edge.id} references a node that does not exist.`, }, { status: 400 });
        }
        if (edge.source === edge.target) {
            return NextResponse.json({ error: `Edge ${edge.id} cannot connect a node to itself.`, },{ status: 400 });
        }
    }

    // Each node may have at most one YES edge and at most one NO edge.
    const connectedBranches = new Set<string>();

    for (const edge of body.edges) {
        const branchKey = `${edge.source}:${edge.sourceHandle}`;
        if (connectedBranches.has(branchKey)) {
            return NextResponse.json({error: `Node ${edge.source} has more than one ${edge.sourceHandle.toUpperCase()} edge.`,}, {status: 400,});
        }
        connectedBranches.add(branchKey);
    }

    const runId = randomUUID();

    await inngest.send({
        name: "flow/run",
        data: { runId, startNodeId: body.startNodeId, nodes: body.nodes, edges: body.edges, },
    });

    return NextResponse.json({ runId, });
}