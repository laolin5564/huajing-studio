import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json({ user: getRequestUser(request) });
  } catch (error) {
    return handleRouteError(error);
  }
}
