import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  deleteOpenAIOAuthSession,
  getOpenAIOAuthSession,
  getOpenAIOAuthSessionByState,
  getRuntimeImageSettings,
  toPublicOpenAIOAuthAccount,
  upsertOpenAIOAuthAccount,
} from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import {
  assertOpenAIOAuthTokenEncryptionReady,
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
    const result = await completeOpenAIOAuth({ code, state, sessionId });

    return htmlResponse(
      `OpenAI 账号已连接：${result.account.email ?? result.account.accountId ?? "OpenAI 账号"}，可以关闭此页面并回到后台刷新。`,
      true,
    );
  } catch (caught) {
    const response = handleRouteError(caught);
    if (response.status >= 500) {
      return htmlResponse("OpenAI OAuth 处理失败，请回到后台查看配置或服务器日志。", false);
    }
    return response;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as {
      callbackUrl?: unknown;
      code?: unknown;
      state?: unknown;
      sessionId?: unknown;
      session_id?: unknown;
    };
    const parsed = parseCallbackPayload(body);
    const result = await completeOpenAIOAuth(parsed);
    return NextResponse.json({ account: result.account });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function completeOpenAIOAuth(input: {
  code: string | null;
  state: string | null;
  sessionId?: string | null;
}): Promise<{
  account: ReturnType<typeof toPublicOpenAIOAuthAccount>;
}> {
  const code = input.code?.trim();
  const state = input.state?.trim();
  const sessionId = input.sessionId?.trim();
  if (!code) {
    throw routeError("OpenAI OAuth callback 缺少 code", 400);
  }

  const session = sessionId ? getOpenAIOAuthSession(sessionId) : state ? getOpenAIOAuthSessionByState(state) : null;
  if (!session) {
    throw routeError("OpenAI OAuth 会话不存在或已过期，请重新发起授权", 400);
  }

  const expectedState = state || session.state;
  if (session.state !== expectedState) {
    throw routeError("OpenAI OAuth state 不匹配，请重新发起授权", 400);
  }

  try {
    assertOpenAIOAuthTokenEncryptionReady();
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI OAuth token 加密配置不可用";
    throw routeError(message, 400);
  }

  const token = await exchangeOpenAIOAuthCode({
    code,
    session,
    proxyUrl: getRuntimeImageSettings().openaiOAuthProxyUrl,
  });
  if (!token.refresh_token) {
    throw routeError("OpenAI OAuth 响应缺少 refresh_token，请重新授权并确认包含 offline_access scope", 400);
  }

  const userInfo = decodeOpenAIIdToken(token.id_token);
  const account = upsertOpenAIOAuthAccount({
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

  return { account: toPublicOpenAIOAuthAccount(account) };
}

function parseCallbackPayload(body: {
  callbackUrl?: unknown;
  code?: unknown;
  state?: unknown;
  sessionId?: unknown;
  session_id?: unknown;
}): {
  code: string | null;
  state: string | null;
  sessionId: string | null;
} {
  const callbackUrl = readString(body.callbackUrl);
  const directCode = readString(body.code);
  const directState = readString(body.state);
  const sessionId = readString(body.sessionId) || readString(body.session_id);
  if (!callbackUrl) {
    return { code: directCode || null, state: directState || null, sessionId: sessionId || null };
  }

  const parsed = parseCallbackUrl(callbackUrl);
  return {
    code: parsed.code || directCode || null,
    state: parsed.state || directState || null,
    sessionId: sessionId || null,
  };
}

function parseCallbackUrl(raw: string): {
  code: string | null;
  state: string | null;
} {
  try {
    const url = new URL(raw);
    const error = url.searchParams.get("error");
    if (error) {
      throw routeError(`OpenAI OAuth 授权失败：${error}`, 400);
    }
    return {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
    };
  } catch (caught) {
    if (isRouteError(caught)) {
      throw caught;
    }
    return {
      code: extractQueryValue(raw, "code") || raw.trim(),
      state: extractQueryValue(raw, "state"),
    };
  }
}

function extractQueryValue(raw: string, key: string): string | null {
  const match = raw.match(new RegExp(`[?&]${key}=([^&#]+)`));
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1].replaceAll("+", "%20"));
  } catch {
    return match[1];
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function routeError(message: string, status: number): { message: string; status: number } {
  return { message, status };
}

function isRouteError(value: unknown): value is { message: string; status: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    "status" in value &&
    typeof (value as { message?: unknown }).message === "string" &&
    typeof (value as { status?: unknown }).status === "number"
  );
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
