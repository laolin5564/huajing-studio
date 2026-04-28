import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { runWebUpdate } from "@/lib/system-update-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const task = runWebUpdate();
    return NextResponse.json({ task });
  } catch (error) {
    if (error instanceof Error && !("status" in error)) {
      return jsonError(error.message, error.message.includes("正在执行") ? 409 : 400);
    }
    return handleRouteError(error);
  }
}
