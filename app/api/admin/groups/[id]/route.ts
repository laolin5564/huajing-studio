import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { toPublicUserGroup, updateUserGroup } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { upsertUserGroupSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const input = upsertUserGroupSchema.partial().parse(await request.json());
    const group = updateUserGroup(id, input);
    return NextResponse.json({ group: toPublicUserGroup(group) });
  } catch (error) {
    return handleRouteError(error);
  }
}
