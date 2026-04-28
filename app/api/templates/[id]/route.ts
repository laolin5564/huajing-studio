import { NextRequest, NextResponse } from "next/server";
import { getTemplate, toPublicTemplate, updateTemplate } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { updateTemplateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireUser(request);
    const { id } = await context.params;
    const template = getTemplate(id);
    if (!template) {
      return jsonError("模板不存在", 404);
    }
    return NextResponse.json({ template: toPublicTemplate(template) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const input = updateTemplateSchema.parse(await request.json());
    const template = updateTemplate(id, input);
    return NextResponse.json({ template: toPublicTemplate(template) });
  } catch (error) {
    return handleRouteError(error);
  }
}
