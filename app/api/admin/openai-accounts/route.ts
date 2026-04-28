import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  createOpenAIOAuthSession as persistOpenAIOAuthSession,
  deleteExpiredOpenAIOAuthSessions,
  listOpenAIOAuthAccounts,
  toPublicOpenAIOAuthAccount,
} from "@/lib/db";
import { handleRouteError } from "@/lib/http";
import {
  buildOpenAIAuthorizationUrl,
  createOpenAIOAuthSession,
  getOpenAIOAuthClientId,
  getOpenAIOAuthRedirectUri,
} from "@/lib/openai-oauth";

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
    deleteExpiredOpenAIOAuthSessions();
    const redirectUri = getOpenAIOAuthRedirectUri(request.url);
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
