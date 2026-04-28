import crypto from "node:crypto";
import { appConfig, IMAGE_USER_AGENT } from "./config";
import { fetchWithOptionalProxy } from "./proxy";
import type { OpenAIOAuthSessionRow } from "./types";

export const openAIOAuthProviderId = "openai_oauth" as const;
export const openAIOAuthImageGenerationScope = "api.model.images.request";

const authorizeUrl = "https://auth.openai.com/oauth/authorize";
const tokenUrl = "https://auth.openai.com/oauth/token";
const defaultScopes = "openid profile email offline_access";
const refreshScopes = "openid profile email";
const defaultClientId = "app_EMoamEEZ73f0CkXaXp7hrann";
export const defaultOpenAIOAuthRedirectUri = "http://localhost:1455/auth/callback";
const sessionTtlMs = 30 * 60 * 1000;
const tokenRefreshSkewMs = 2 * 60 * 1000;

export interface OpenAITokenResponse {
  access_token: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface DecodedOpenAIUserInfo {
  email: string | null;
  accountId: string | null;
  userId: string | null;
  organizationId: string | null;
  planType: string | null;
}

export function getOpenAIOAuthClientId(): string {
  return appConfig.openaiOAuthClientId || defaultClientId;
}

export function getOpenAIOAuthRedirectUri(): string {
  if (appConfig.openaiOAuthRedirectUri) {
    return appConfig.openaiOAuthRedirectUri;
  }
  return defaultOpenAIOAuthRedirectUri;
}

export function createOpenAIOAuthSession(redirectUri: string): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  expiresAt: string;
} {
  const state = crypto.randomBytes(32).toString("hex");
  const codeVerifier = crypto.randomBytes(64).toString("hex");
  return {
    state,
    codeVerifier,
    codeChallenge: createCodeChallenge(codeVerifier),
    redirectUri,
    expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(),
  };
}

export function buildOpenAIAuthorizationUrl(input: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getOpenAIOAuthClientId(),
    redirect_uri: input.redirectUri,
    scope: defaultScopes,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
  });
  return `${authorizeUrl}?${params.toString()}`;
}

export async function exchangeOpenAIOAuthCode(input: {
  code: string;
  session: OpenAIOAuthSessionRow;
  proxyUrl?: string | null;
  signal?: AbortSignal;
}): Promise<OpenAITokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.session.client_id || getOpenAIOAuthClientId(),
    code: input.code,
    redirect_uri: input.session.redirect_uri,
    code_verifier: input.session.code_verifier,
  });
  return postTokenRequest(params, input.signal, input.proxyUrl);
}

export async function refreshOpenAIOAuthToken(input: {
  refreshToken: string;
  clientId?: string | null;
  proxyUrl?: string | null;
  signal?: AbortSignal;
}): Promise<OpenAITokenResponse> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: input.clientId || getOpenAIOAuthClientId(),
    scope: refreshScopes,
  });
  return postTokenRequest(params, input.signal, input.proxyUrl);
}

async function postTokenRequest(
  params: URLSearchParams,
  signal?: AbortSignal,
  proxyUrl?: string | null,
): Promise<OpenAITokenResponse> {
  const response = await fetchWithOptionalProxy(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "codex-cli/0.91.0",
    },
    body: params.toString(),
    signal,
  }, proxyUrl);

  if (!response.ok) {
    const text = await response.text();
    const sanitized = sanitizeErrorText(text);
    if (sanitized.includes("token_exchange_user_error")) {
      throw new Error(
        `OpenAI OAuth token request failed: ${response.status} 授权链接已使用或过期，请重新发起 OpenAI 授权。`,
      );
    }
    throw new Error(`OpenAI OAuth token request failed: ${response.status}${sanitized ? ` ${sanitized}` : ""}`);
  }

  const payload = (await response.json()) as OpenAITokenResponse;
  if (!payload.access_token) {
    throw new Error("OpenAI OAuth token response missing access_token");
  }
  return payload;
}

function createCodeChallenge(codeVerifier: string): string {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

export function tokenExpiresAt(expiresIn?: number): string {
  const seconds = Number.isFinite(expiresIn) && expiresIn ? Math.max(60, Math.floor(expiresIn)) : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function shouldRefreshOpenAIToken(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now() + tokenRefreshSkewMs;
}

export function assertOpenAIOAuthTokenEncryptionReady(): void {
  getEncryptionKey();
}

export function decodeOpenAIIdToken(idToken?: string | null): DecodedOpenAIUserInfo {
  if (!idToken) {
    return emptyUserInfo();
  }

  const parts = idToken.split(".");
  if (parts.length !== 3) {
    return emptyUserInfo();
  }

  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      email?: string;
      sub?: string;
      [key: string]: unknown;
    };
    const auth = claims["https://api.openai.com/auth"] as
      | {
          chatgpt_account_id?: string;
          chatgpt_user_id?: string;
          chatgpt_plan_type?: string;
          user_id?: string;
          organizations?: Array<{ id?: string; is_default?: boolean }>;
        }
      | undefined;
    const defaultOrg = auth?.organizations?.find((item) => item.is_default) ?? auth?.organizations?.[0];
    return {
      email: claims.email ?? null,
      accountId: auth?.chatgpt_account_id ?? null,
      userId: auth?.chatgpt_user_id ?? auth?.user_id ?? claims.sub ?? null,
      organizationId: defaultOrg?.id ?? null,
      planType: auth?.chatgpt_plan_type ?? null,
    };
  } catch {
    return emptyUserInfo();
  }
}

function emptyUserInfo(): DecodedOpenAIUserInfo {
  return {
    email: null,
    accountId: null,
    userId: null,
    organizationId: null,
    planType: null,
  };
}

export function encryptToken(plainText: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptToken(payload: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("OpenAI OAuth token ciphertext format is invalid");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getEncryptionKey(): Buffer {
  const raw = appConfig.openaiOAuthTokenEncryptionKey.trim();
  if (!raw) {
    throw new Error("OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY 未配置，无法保存或读取 OpenAI OAuth token");
  }

  if (raw.startsWith("base64:")) {
    const decoded = Buffer.from(raw.slice("base64:".length), "base64");
    if (decoded.length !== 32) {
      throw new Error("OPENAI_OAUTH_TOKEN_ENCRYPTION_KEY base64 解码后必须为 32 字节");
    }
    return decoded;
  }

  return crypto.createHash("sha256").update(raw).digest();
}

function sanitizeErrorText(text: string): string {
  return text
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[redacted]"')
    .replace(/"id_token"\s*:\s*"[^"]+"/gi, '"id_token":"[redacted]"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export const openAIImageHeaders = {
  "User-Agent": IMAGE_USER_AGENT,
};
