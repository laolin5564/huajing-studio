import { NextRequest, NextResponse } from "next/server";
import {
  createGenerationTask,
  getConversation,
  getImageFilePathById,
  getTaskImages,
  listGenerationTasks,
  toPublicTask,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertConversationAccess, assertImageReferenceAccess, assertQuotaAvailable } from "@/lib/permissions";
import { createGenerationTaskSchema, listTasksQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const query = listTasksQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const rows = listGenerationTasks({
      userId: user.id,
      isAdmin: user.role === "admin",
      statuses: query.status,
      limit: query.limit,
    });
    const tasks = rows.map((task) => toPublicTask(task, getTaskImages(task.id)));
    return NextResponse.json({ tasks });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const body = await request.json();
    const input = createGenerationTaskSchema.parse(body);

    if (input.conversationId) {
      const conversation = getConversation(input.conversationId);
      if (!conversation) {
        return jsonError("会话不存在", 404);
      }
      assertConversationAccess(user, conversation);
    }

    if (input.sourceImageId) {
      assertImageReferenceAccess(user, input.sourceImageId);
    }

    if (input.mode !== "text_to_image" && !getImageFilePathById(input.sourceImageId ?? "")) {
      return jsonError("参考图不存在或已无法访问", 400);
    }

    assertQuotaAvailable(user, input.quantity);

    const task = createGenerationTask({
      ...input,
      userId: user.id,
    });
    return NextResponse.json(
      {
        taskId: task.id,
        conversationId: task.conversation_id,
        status: task.status,
        task: toPublicTask(task),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
