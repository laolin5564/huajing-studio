import { NextRequest, NextResponse } from "next/server";
import { cancelGenerationTask, getGenerationTask, getTaskImages, toPublicTask } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertTaskAccess } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

    const canceled = cancelGenerationTask(id);
    if (!canceled) {
      return jsonError("任务不存在", 404);
    }

    return NextResponse.json({ task: toPublicTask(canceled, getTaskImages(id)) });
  } catch (error) {
    return handleRouteError(error);
  }
}
