import { NextRequest, NextResponse } from "next/server";
import { deleteGeneratedImagesByIds, getGeneratedImage } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertGeneratedImageAccess } from "@/lib/permissions";
import { deleteStorageFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const { id } = await context.params;
    const image = getGeneratedImage(id);
    if (!image) {
      return jsonError("历史图片不存在", 404);
    }
    assertGeneratedImageAccess(user, image);

    const deleted = deleteGeneratedImagesByIds([id]);
    await Promise.all(deleted.map((item) => deleteStorageFile(item.file_path)));
    return NextResponse.json({ deleted: deleted.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
