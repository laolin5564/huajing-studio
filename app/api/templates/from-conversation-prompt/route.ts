import { NextRequest, NextResponse } from "next/server";
import { createTemplate, getConversation, toPublicTemplate } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeConversationFixedPrompt } from "@/lib/conversation-prompt";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertConversationAccess } from "@/lib/permissions";
import { createTemplateFromConversationPromptSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const input = createTemplateFromConversationPromptSchema.parse(await request.json());
    const conversation = getConversation(input.conversationId);
    if (!conversation) {
      return jsonError("会话不存在", 404);
    }
    assertConversationAccess(user, conversation);

    const fixedPrompt = normalizeConversationFixedPrompt(conversation.fixed_prompt);
    if (!conversation.fixed_prompt_enabled || !fixedPrompt) {
      return jsonError("当前会话没有可保存的固定提示词", 400);
    }

    const template = createTemplate({
      name: input.name,
      category: input.category,
      description: input.description ?? `来自会话：${conversation.title}`,
      defaultPrompt: fixedPrompt,
      defaultNegativePrompt: null,
      defaultSize: "auto",
      defaultReferenceStrength: 0.65,
      defaultStyleStrength: 0.7,
      sourceImageId: null,
    });

    return NextResponse.json({ template: toPublicTemplate(template) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
