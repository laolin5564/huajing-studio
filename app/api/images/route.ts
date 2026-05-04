import { NextRequest, NextResponse } from "next/server";
import { deleteGeneratedImagesByIds, getGeneratedImagesByIds, listImages, toPublicImage } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertGeneratedImageAccess } from "@/lib/permissions";
import { deleteStorageFile } from "@/lib/storage";
import { deleteImagesSchema, listImagesQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const query = listImagesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const images = listImages({
      ...query,
      userId: user.id,
      isAdmin: user.role === "admin",
    }).map(toPublicImage);
    return NextResponse.json({ images, page: query.page, pageSize: query.pageSize });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const input = deleteImagesSchema.parse(await request.json());
    const uniqueIds = Array.from(new Set(input.imageIds));
    const images = getGeneratedImagesByIds(uniqueIds);
    if (images.length !== uniqueIds.length) {
      return jsonError("部分历史图片不存在", 404);
    }

    for (const image of images) {
      assertGeneratedImageAccess(user, image);
    }

    const deleted = deleteGeneratedImagesByIds(uniqueIds);
    await Promise.all(deleted.map((image) => deleteStorageFile(image.file_path)));
    return NextResponse.json({ deleted: deleted.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
