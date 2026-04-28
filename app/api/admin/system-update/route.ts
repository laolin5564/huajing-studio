import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { checkSystemUpdate, getSystemUpdateFallbackInfo } from "@/lib/update";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    try {
      const update = await checkSystemUpdate();
      return NextResponse.json({ update, error: null });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "检查更新失败";
      return NextResponse.json({ update: getSystemUpdateFallbackInfo(), error: message }, { status: 200 });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
