import { NextRequest, NextResponse } from "next/server";
import { createTemplate, getGeneratedImage, toPublicTemplate } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { sizeFromDimensions } from "@/lib/image-options";
import { assertGeneratedImageAccess } from "@/lib/permissions";
import { createTemplateFromImageSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const input = createTemplateFromImageSchema.parse(await request.json());
    const image = getGeneratedImage(input.imageId);
    if (!image) {
      return jsonError("历史图片不存在", 404);
    }
    assertGeneratedImageAccess(user, image);

    const template = createTemplate({
      name: input.name,
      category: input.category,
      description: input.description,
      defaultPrompt: image.prompt,
      defaultNegativePrompt: null,
      defaultSize: sizeFromDimensions(image.width, image.height),
      defaultReferenceStrength: 0.6,
      defaultStyleStrength: 0.7,
      sourceImageId: image.id,
    });

    return NextResponse.json({ template: toPublicTemplate(template) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
