import { NextRequest, NextResponse } from "next/server";
import { createTemplate, listTemplates, toPublicTemplate } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/http";
import { createTemplateSchema } from "@/lib/validation";
import { templateCategories } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireUser(request);
    const category = request.nextUrl.searchParams.get("category");
    const safeCategory = templateCategories.includes(category as (typeof templateCategories)[number])
      ? (category as (typeof templateCategories)[number])
      : undefined;
    const templates = listTemplates(safeCategory).map(toPublicTemplate);
    return NextResponse.json({ templates });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const input = createTemplateSchema.parse(await request.json());
    const template = createTemplate(input);
    return NextResponse.json({ template: toPublicTemplate(template) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
