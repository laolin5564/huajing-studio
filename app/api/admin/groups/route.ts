import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createUserGroup, listUserGroups, toPublicUserGroup } from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import { upsertUserGroupSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const groups = listUserGroups().map(toPublicUserGroup);
    return NextResponse.json({ groups });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const input = upsertUserGroupSchema.parse(await request.json());
    const group = createUserGroup(input);
    return NextResponse.json({ group: toPublicUserGroup(group) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
