import { NextRequest, NextResponse } from "next/server";

function buildMovedResponse(agentId: string) {
  return NextResponse.json(
    {
      error: "Widget management moved to /widgets.",
      movedTo: `/widgets?agent=${encodeURIComponent(agentId)}`,
    },
    { status: 410 },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return buildMovedResponse(id);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return buildMovedResponse(id);
}
