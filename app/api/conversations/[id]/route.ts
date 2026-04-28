import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  listConversationMessages,
  listConversationTasks,
  toPublicConversation,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertConversationAccess } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const { id } = await context.params;
    const conversation = getConversation(id);
    if (!conversation) {
      return jsonError("会话不存在", 404);
    }
    assertConversationAccess(user, conversation);

    return NextResponse.json({
      conversation: toPublicConversation(conversation, {
        messages: listConversationMessages(id),
        tasks: listConversationTasks(id),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
