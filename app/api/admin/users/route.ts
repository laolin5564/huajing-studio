import { NextRequest, NextResponse } from "next/server";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { createUser, getUserByEmail, getUserGroup, listUsers, toPublicUser } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { createAdminUserSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const users = listUsers().map(toPublicUser);
    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const input = createAdminUserSchema.parse(await request.json());

    if (getUserByEmail(input.email)) {
      return jsonError("该邮箱已注册", 409);
    }

    if (input.groupId && !getUserGroup(input.groupId)) {
      return jsonError("分组不存在", 400);
    }

    const user = createUser({
      email: input.email,
      name: input.name,
      passwordHash: hashPassword(input.password),
      role: input.role,
      groupId: input.groupId,
      monthlyQuota: input.monthlyQuota,
    });

    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
