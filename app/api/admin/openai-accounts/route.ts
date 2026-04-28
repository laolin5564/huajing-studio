import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createOpenAIOAuthSession as persistOpenAIOAuthSession,
  deleteExpiredOpenAIOAuthSessions,
  listOpenAIOAuthAccounts,
  setAppSetting,
  toPublicOpenAIOAuthAccount,
} from "@/lib/db";
import { handleRouteError, jsonError } from "@/lib/http";
import {
  buildOpenAIAuthorizationUrl,
  createOpenAIOAuthSession,
  getOpenAIOAuthClientId,
  getOpenAIOAuthRedirectUri,
} from "@/lib/openai-oauth";
import { normalizeProxyUrl } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    return NextResponse.json({ accounts: listOpenAIOAuthAccounts().map(toPublicOpenAIOAuthAccount) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as { proxyUrl?: unknown };
    if (typeof body.proxyUrl === "string" && body.proxyUrl.trim()) {
      try {
        setAppSetting("openai_oauth_proxy_url", normalizeProxyUrl(body.proxyUrl));
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "代理地址不正确", 400);
      }
    }
    deleteExpiredOpenAIOAuthSessions();
    const redirectUri = getOpenAIOAuthRedirectUri();
    const session = createOpenAIOAuthSession(redirectUri);
    const savedSession = persistOpenAIOAuthSession({
      state: session.state,
      codeVerifier: session.codeVerifier,
      redirectUri: session.redirectUri,
      clientId: getOpenAIOAuthClientId(),
      expiresAt: session.expiresAt,
    });
    return NextResponse.json({
      authUrl: buildOpenAIAuthorizationUrl(session),
      sessionId: savedSession.id,
      redirectUri,
      expiresAt: savedSession.expires_at,
      experimental: true,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
