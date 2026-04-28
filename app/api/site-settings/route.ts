import { NextResponse } from "next/server";
import { getPublicSiteSettings } from "@/lib/db";
import { handleRouteError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ settings: getPublicSiteSettings() });
  } catch (error) {
    return handleRouteError(error);
  }
}
