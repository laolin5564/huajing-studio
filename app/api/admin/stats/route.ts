import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getAdminStats } from "@/lib/db";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    return NextResponse.json({ stats: getAdminStats() });
  } catch (error) {
    return handleRouteError(error);
  }
}
