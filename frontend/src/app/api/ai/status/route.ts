import { NextResponse } from "next/server";
import { getMultiAIProvider } from "@/lib/ai";

export async function GET() {
  const orchestrator = getMultiAIProvider();
  const status = orchestrator.getStatus();

  return NextResponse.json({
    status: "ok",
    ...status,
    timestamp: new Date().toISOString(),
  });
}
