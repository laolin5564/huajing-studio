import { NextRequest, NextResponse } from "next/server";
import {
  getConversation,
  listConversationMessages,
  listConversationTasks,
  toPublicConversation,
  updateConversationFixedPrompt,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertConversationAccess } from "@/lib/permissions";
import { updateConversationFixedPromptSchema } from "@/lib/validation";

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

export async function PATCH(
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

    const input = updateConversationFixedPromptSchema.parse(await request.json());
    if (input.enabled && !input.fixedPrompt) {
      return jsonError("请输入会话固定提示词", 400);
    }

    const updated = updateConversationFixedPrompt(id, {
      enabled: input.enabled,
      fixedPrompt: input.fixedPrompt,
    });

    return NextResponse.json({
      conversation: toPublicConversation(updated, {
        messages: listConversationMessages(id),
        tasks: listConversationTasks(id),
      }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
