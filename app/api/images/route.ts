import { NextRequest, NextResponse } from "next/server";
import { listImages, toPublicImage } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { listImagesQuerySchema } from "@/lib/validation";

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
