import { NextRequest, NextResponse } from "next/server";
import {
  createGenerationTask,
  getConversation,
  getGeneratedImage,
  getImageFilePathById,
  getLatestConversationImage,
  getTaskImages,
  toPublicTask,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import {
  assertConversationAccess,
  assertGeneratedImageAccess,
  assertImageReferenceAccess,
  assertQuotaAvailable,
} from "@/lib/permissions";
import { continueConversationSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

    const input = continueConversationSchema.parse(await request.json());
    const latestImage = getLatestConversationImage(id);
    const sourceImage = input.sourceImageId ? getGeneratedImage(input.sourceImageId) : latestImage;

    if (!sourceImage || !getImageFilePathById(sourceImage.id)) {
      return jsonError("当前会话还没有可继续改图的图片", 400);
    }
    assertGeneratedImageAccess(user, sourceImage);
    if (input.referenceImageId) {
      assertImageReferenceAccess(user, input.referenceImageId);
      if (!getImageFilePathById(input.referenceImageId)) {
        return jsonError("参考图不存在或已无法访问", 400);
      }
    }
    assertQuotaAvailable(user, input.quantity);

    const task = createGenerationTask({
      userId: user.id,
      conversationId: id,
      mode: "edit_image",
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      size: input.size,
      quantity: input.quantity,
      templateId: sourceImage.template_id,
      sourceImageId: sourceImage.id,
      referenceImageId: input.referenceImageId,
      referenceStrength: input.referenceStrength,
      styleStrength: input.styleStrength,
    });

    return NextResponse.json(
      {
        taskId: task.id,
        conversationId: id,
        status: task.status,
        task: toPublicTask(task, getTaskImages(task.id)),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
