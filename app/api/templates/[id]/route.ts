import { NextRequest, NextResponse } from "next/server";
import { deleteTemplate, getTemplate, toPublicTemplate, updateTemplate } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/http";
import { assertTemplateManageAccess, assertTemplateReadAccess } from "@/lib/permissions";
import { updateTemplateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const { id } = await context.params;
    const template = getTemplate(id);
    if (!template) {
      return jsonError("模板不存在", 404);
    }
    assertTemplateReadAccess(user, template);
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
    const user = requireUser(request);
    const { id } = await context.params;
    const existing = getTemplate(id);
    if (!existing) {
      return jsonError("模板不存在", 404);
    }
    assertTemplateManageAccess(user, existing);
    const input = updateTemplateSchema.parse(await request.json());
    const templateInput = { ...input };
    delete templateInput.scope;
    const template = updateTemplate(id, templateInput);
    return NextResponse.json({ template: toPublicTemplate(template) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = requireUser(request);
    const { id } = await context.params;
    const template = getTemplate(id);
    if (!template) {
      return jsonError("模板不存在", 404);
    }
    assertTemplateManageAccess(user, template);
    const deleted = deleteTemplate(id);
    return NextResponse.json({ template: toPublicTemplate(deleted) });
  } catch (error) {
    return handleRouteError(error);
  }
}
