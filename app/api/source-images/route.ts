import { NextRequest, NextResponse } from "next/server";
import { createId, createSourceImage, imagePublicUrl } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertSupportedImageBytes, saveSourceImageFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const formData = await request.formData();
    const value = formData.get("image");

    if (!(value instanceof File)) {
      return jsonError("请上传参考图", 400);
    }

    const bytes = new Uint8Array(await value.arrayBuffer());
    assertSupportedImageBytes(bytes, value.type);
    const sourceId = createId("src");
    const filePath = await saveSourceImageFile({
      sourceId,
      fileName: value.name,
      bytes,
      mimeType: value.type,
    });

    const source = createSourceImage({
      userId: user.id,
      filePath,
      width: 0,
      height: 0,
      originalName: value.name,
      mimeType: value.type,
    });

    return NextResponse.json(
      {
        imageId: source.id,
        url: imagePublicUrl(source.file_path),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
