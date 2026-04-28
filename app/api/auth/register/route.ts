import { NextRequest, NextResponse } from "next/server";
import {
  createUserSession,
  defaultGroupIdForRegistration,
  defaultQuotaForRegistration,
  hashPassword,
  isRegistrationOpen,
  nextUserRoleForRegistration,
  setSessionCookie,
} from "@/lib/auth";
import { createUser, getUserByEmail, toPublicUser } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { registerSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const input = registerSchema.parse(await request.json());
    if (!isRegistrationOpen()) {
      return jsonError("当前站点暂未开放注册，请联系管理员创建账号", 403);
    }

    if (getUserByEmail(input.email)) {
      return jsonError("该邮箱已注册", 409);
    }

    const user = createUser({
      email: input.email,
      name: input.name,
      passwordHash: hashPassword(input.password),
      role: nextUserRoleForRegistration(),
      groupId: defaultGroupIdForRegistration(),
      monthlyQuota: defaultQuotaForRegistration(),
    });
    const { token } = createUserSession(user.id);
    const response = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
