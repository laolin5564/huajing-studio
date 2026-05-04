import { NextRequest, NextResponse } from "next/server";
import { listAwesomeCases } from "@/lib/awesome-case-library";
import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireUser(request);
    const params = request.nextUrl.searchParams;
    const payload = listAwesomeCases({
      query: params.get("q"),
      category: params.get("category"),
      style: params.get("style"),
      scene: params.get("scene"),
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 12),
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
