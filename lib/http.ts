import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const message = error.issues.map((issue) => issue.message).join("; ");
    return jsonError(message || "请求参数不正确", 400);
  }

  if (error instanceof Error) {
    const status = "status" in error && typeof error.status === "number" ? error.status : 500;
    return jsonError(error.message, status);
  }

  if (typeof error === "object" && error && "status" in error && "message" in error) {
    const status = typeof error.status === "number" ? error.status : 500;
    const message = typeof error.message === "string" ? error.message : "服务器处理失败";
    return jsonError(message, status);
  }

  return jsonError("服务器处理失败", 500);
}
