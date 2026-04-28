import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getUserGroup, toPublicUser, updateUser } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { updateUserSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const admin = requireAdmin(request);
    const { id } = await context.params;
    const input = updateUserSchema.parse(await request.json());

    if (input.groupId && !getUserGroup(input.groupId)) {
      return jsonError("分组不存在", 400);
    }

    if (admin.id === id && input.role && input.role !== "admin") {
      return jsonError("不能移除自己的管理员权限", 400);
    }

    const user = updateUser(id, input);

    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}
