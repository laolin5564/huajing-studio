import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getOpenAIOAuthAccount,
  toPublicOpenAIOAuthAccount,
  updateOpenAIOAuthAccountStatus,
} from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { openAIOAuthStatusSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const { id } = await params;
    const input = openAIOAuthStatusSchema.parse(await request.json());
    const account = getOpenAIOAuthAccount(id);
    if (!account) {
      return jsonError("OpenAI OAuth 账号不存在", 404);
    }
    updateOpenAIOAuthAccountStatus(id, input.status, input.status === "disabled" ? "管理员已禁用" : null);
    const updated = getOpenAIOAuthAccount(id);
    if (!updated) {
      return jsonError("OpenAI OAuth 账号更新失败", 500);
    }
    return NextResponse.json({ account: toPublicOpenAIOAuthAccount(updated) });
  } catch (error) {
    return handleRouteError(error);
  }
}
