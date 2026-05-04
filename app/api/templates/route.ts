import { NextRequest, NextResponse } from "next/server";
import { createTemplate, listTemplates, toPublicTemplate } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { createTemplateSchema, listTemplatesQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const query = listTemplatesQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const templates = listTemplates({
      userId: user.id,
      category: query.category,
      scope: query.scope,
    }).map(toPublicTemplate);
    return NextResponse.json({ templates });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const input = createTemplateSchema.parse(await request.json());
    if (input.scope === "platform" && user.role !== "admin") {
      return jsonError("只有管理员可以创建平台模板", 403);
    }
    const template = createTemplate({
      ...input,
      ownerUserId: input.scope === "platform" ? null : user.id,
    });
    return NextResponse.json({ template: toPublicTemplate(template) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
