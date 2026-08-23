import { NextResponse } from "next/server";
import { getRun } from "@/lib/runStore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const run = getRun(runId);

  if (!run) {
    return NextResponse.json({ error: `Run ${runId} not found.` }, { status: 404 });
  }

  return NextResponse.json(run);
}