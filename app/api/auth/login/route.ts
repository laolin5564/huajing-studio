import { NextRequest, NextResponse } from "next/server";
import { createUserSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { getUserByEmail, toPublicUser } from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const input = loginSchema.parse(await request.json());
    const user = getUserByEmail(input.email);
    if (!user || !verifyPassword(input.password, user.password_hash)) {
      return jsonError("邮箱或密码不正确", 401);
    }

    const { token } = createUserSession(user.id);
    const response = NextResponse.json({ user: toPublicUser(user) });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
