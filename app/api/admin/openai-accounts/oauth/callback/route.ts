import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  deleteOpenAIOAuthSession,
  getOpenAIOAuthSession,
  getOpenAIOAuthSessionByState,
  upsertOpenAIOAuthAccount,
} from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import {
  decodeOpenAIIdToken,
  encryptToken,
  exchangeOpenAIOAuthCode,
  tokenExpiresAt,
} from "@/lib/openai-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    if (error) {
      return htmlResponse(`OpenAI OAuth 授权失败：${escapeHtml(error)}`, false);
    }

    const sessionId = url.searchParams.get("session_id") ?? url.searchParams.get("sessionId");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) {
      return jsonError("OpenAI OAuth callback 缺少 code 或 state", 400);
    }

    const session = sessionId ? getOpenAIOAuthSession(sessionId) : getOpenAIOAuthSessionByState(state);
    if (!session || session.state !== state) {
      return jsonError("OpenAI OAuth 会话不存在、已过期或 state 不匹配", 400);
    }

    const token = await exchangeOpenAIOAuthCode({ code, session });
    if (!token.refresh_token) {
      return jsonError("OpenAI OAuth 响应缺少 refresh_token，请重新授权并确认包含 offline_access scope", 400);
    }

    const userInfo = decodeOpenAIIdToken(token.id_token);
    upsertOpenAIOAuthAccount({
      email: userInfo.email,
      accountId: userInfo.accountId,
      userId: userInfo.userId,
      organizationId: userInfo.organizationId,
      planType: userInfo.planType,
      clientId: session.client_id,
      accessTokenCiphertext: encryptToken(token.access_token),
      refreshTokenCiphertext: encryptToken(token.refresh_token),
      expiresAt: tokenExpiresAt(token.expires_in),
    });
    deleteOpenAIOAuthSession(session.id);

    return htmlResponse("OpenAI 账号已连接，可以关闭此页面并回到后台刷新。", true);
  } catch (caught) {
    const response = handleRouteError(caught);
    if (response.status >= 500) {
      return htmlResponse("OpenAI OAuth 处理失败，请回到后台查看配置或服务器日志。", false);
    }
    return response;
  }
}

function htmlResponse(message: string, ok: boolean): NextResponse {
  const title = ok ? "连接成功" : "连接失败";
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f172a;color:#e5e7eb;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:560px;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.9);border-radius:24px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.35)}.badge{display:inline-flex;border-radius:999px;padding:6px 10px;background:${ok ? "#064e3b" : "#7f1d1d"};color:#fff;font-size:13px}h1{margin:16px 0 10px;font-size:24px}p{line-height:1.7;color:#cbd5e1}</style></head><body><main class="card"><span class="badge">${title}</span><h1>${title}</h1><p>${escapeHtml(message)}</p></main></body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: ok ? 200 : 400,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
