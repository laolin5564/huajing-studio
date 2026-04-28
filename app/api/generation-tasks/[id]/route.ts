import { NextRequest, NextResponse } from "next/server";
import { getGenerationTask, getTaskImages, toPublicTask } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertTaskAccess } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const { id } = await context.params;
    const task = getGenerationTask(id);
    if (!task) {
      return jsonError("任务不存在", 404);
    }
    assertTaskAccess(user, task);

    return NextResponse.json({ task: toPublicTask(task, getTaskImages(id)) });
  } catch (error) {
    return handleRouteError(error);
  }
}
