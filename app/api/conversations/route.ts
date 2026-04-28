import { NextRequest, NextResponse } from "next/server";
import { listConversations, toPublicConversation } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 30);
    const conversations = listConversations({
      userId: user.id,
      isAdmin: user.role === "admin",
      limit,
    }).map((conversation) => toPublicConversation(conversation));
    return NextResponse.json({ conversations });
  } catch (error) {
    return handleRouteError(error);
  }
}
