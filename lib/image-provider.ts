import { readFile } from "node:fs/promises";
import path from "node:path";
import { appConfig, IMAGE_USER_AGENT } from "./config";
import {
  getRuntimeImageSettings,
  getUsableOpenAIOAuthAccount,
  updateOpenAIOAuthAccountStatus,
  updateOpenAIOAuthAccountTokens,
} from "./db";
import { apiSizeForOption } from "./image-options";
import {
  decodeOpenAIIdToken,
  decryptToken,
  encryptToken,
  refreshOpenAIOAuthToken,
  shouldRefreshOpenAIToken,
  tokenExpiresAt,
} from "./openai-oauth";
import type { GenerationTaskRow, ImageProvider, OpenAIOAuthAccountRow } from "./types";
import { mimeFromFileName, resolveStoragePath } from "./storage";

interface ImageApiItem {
  b64_json?: string;
  url?: string;
}

interface ImageApiResponse {
  data?: ImageApiItem[];
}

interface ImageRequestSettings {
  provider: ImageProvider;
  baseUrl: string;
  bearerToken: string;
  imageModel: string;
  imageConcurrency: number;
  oauthAccountId?: string;
}

export interface MaterializedImage {
  bytes: Uint8Array;
  mimeType: string | null;
}

export async function callImageModel(
  task: GenerationTaskRow,
  sourceImagePath: string | null,
  signal?: AbortSignal,
): Promise<MaterializedImage[]> {
  const settings = await resolveImageProviderSettings(signal);

  const images: MaterializedImage[] = [];
  while (images.length < task.quantity) {
    const remaining = task.quantity - images.length;
    const batchSize = Math.min(remaining, settings.imageConcurrency);
    const batch = await Promise.all(
      Array.from({ length: batchSize }, async () => {
        const result =
          task.mode === "text_to_image"
            ? await requestTextToImage(task, settings, 1, signal)
            : await requestImageEdit(task, sourceImagePath, settings, 1, signal);
        return normalizeImageItems(result);
      }),
    );
    const items = batch.flat();
    if (items.length === 0) {
      throw new Error("image-2 未返回图片数据");
    }

    for (const item of items.slice(0, remaining)) {
      images.push(await materializeImageItem(item, signal));
    }
  }
  return images;
}

async function resolveImageProviderSettings(signal?: AbortSignal): Promise<ImageRequestSettings> {
  const settings = getRuntimeImageSettings();
  if (settings.imageProvider === "openai_oauth") {
    const account = getUsableOpenAIOAuthAccount();
    if (!account) {
      throw new Error("已选择 OpenAI OAuth 模式，但后台没有可用 OpenAI 账号");
    }
    const accessToken = await getFreshOpenAIAccessToken(account, signal);
    return {
      provider: "openai_oauth",
      baseUrl: appConfig.openaiOAuthApiBaseUrl.replace(/\/+$/, ""),
      bearerToken: accessToken,
      imageModel: settings.imageModel,
      imageConcurrency: settings.imageConcurrency,
      oauthAccountId: account.id,
    };
  }

  if (!settings.sub2apiApiKey) {
    throw new Error("SUB2API_API_KEY 未配置，无法调用 image-2");
  }
  return {
    provider: "sub2api",
    baseUrl: settings.sub2apiBaseUrl.replace(/\/+$/, ""),
    bearerToken: settings.sub2apiApiKey,
    imageModel: settings.imageModel,
    imageConcurrency: settings.imageConcurrency,
  };
}

async function getFreshOpenAIAccessToken(account: OpenAIOAuthAccountRow, signal?: AbortSignal): Promise<string> {
  if (!shouldRefreshOpenAIToken(account.expires_at)) {
    return decryptToken(account.access_token_ciphertext);
  }

  try {
    const currentRefreshToken = decryptToken(account.refresh_token_ciphertext);
    const refreshed = await refreshOpenAIOAuthToken({
      refreshToken: currentRefreshToken,
      clientId: account.client_id,
      signal: requestSignal(signal),
    });
    const userInfo = decodeOpenAIIdToken(refreshed.id_token);
    const nextRefreshToken = refreshed.refresh_token || currentRefreshToken;
    updateOpenAIOAuthAccountTokens(account.id, {
      accessTokenCiphertext: encryptToken(refreshed.access_token),
      refreshTokenCiphertext: encryptToken(nextRefreshToken),
      expiresAt: tokenExpiresAt(refreshed.expires_in),
      email: userInfo.email,
      accountId: userInfo.accountId,
      userId: userInfo.userId,
      organizationId: userInfo.organizationId,
      planType: userInfo.planType,
    });
    return refreshed.access_token;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI OAuth token refresh failed";
    updateOpenAIOAuthAccountStatus(account.id, "error", message);
    throw new Error(`OpenAI OAuth token 刷新失败：${message}`);
  }
}

async function requestTextToImage(
  task: GenerationTaskRow,
  settings: ImageRequestSettings,
  quantity: number,
  signal?: AbortSignal,
): Promise<unknown> {
  const body: Record<string, string | number> = {
    model: settings.imageModel,
    prompt: buildPrompt(task),
    n: quantity,
  };

  const apiSize = apiSizeForOption(task.size);
  if (apiSize) {
    body.size = apiSize;
  }

  const response = await fetch(`${settings.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.bearerToken}`,
      "Content-Type": "application/json",
      "User-Agent": IMAGE_USER_AGENT,
    },
    body: JSON.stringify(body),
    signal: requestSignal(signal),
  });

  return readModelResponse(response, "image generation failed", settings);
}

async function requestImageEdit(
  task: GenerationTaskRow,
  sourceImagePath: string | null,
  settings: ImageRequestSettings,
  quantity: number,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!sourceImagePath) {
    throw new Error("缺少参考图，无法调用图片编辑接口");
  }

  const absolutePath = resolveStoragePath(sourceImagePath);
  const bytes = await readFile(absolutePath);
  const mimeType = mimeFromFileName(sourceImagePath);
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const form = new FormData();
  form.append("model", settings.imageModel);
  form.append("image", blob, path.basename(sourceImagePath));
  form.append("prompt", buildPrompt(task));
  form.append("n", String(quantity));
  const apiSize = apiSizeForOption(task.size);
  if (apiSize) {
    form.append("size", apiSize);
  }

  const response = await fetch(`${settings.baseUrl}/images/edits`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.bearerToken}`,
      "User-Agent": IMAGE_USER_AGENT,
    },
    body: form,
    signal: requestSignal(signal),
  });

  return readModelResponse(response, "image edit failed", settings);
}

function buildPrompt(task: GenerationTaskRow): string {
  const parts = [task.prompt.trim()];
  if (task.negative_prompt && task.negative_prompt.trim() !== "") {
    parts.push(`避免出现：${task.negative_prompt.trim()}`);
  }

  if (task.mode !== "text_to_image") {
    parts.push(`参考强度：${task.reference_strength.toFixed(2)}；风格强度：${task.style_strength.toFixed(2)}。`);
  }

  return parts.join("\n");
}

async function readModelResponse(
  response: Response,
  fallback: string,
  settings: ImageRequestSettings,
): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text();
    const message = formatModelError(response.status, text, fallback);
    if (settings.provider === "openai_oauth" && response.status === 401 && settings.oauthAccountId) {
      updateOpenAIOAuthAccountStatus(settings.oauthAccountId, "error", message);
    }
    throw new Error(message);
  }

  return response.json();
}

function formatModelError(status: number, text: string, fallback: string): string {
  const plainText = text
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[redacted]"')
    .replace(/"id_token"\s*:\s*"[^"]+"/gi, '"id_token":"[redacted]"')
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (status === 524 || /timeout occurred/i.test(text)) {
    return "模型接口超时（524）：上游生成服务响应太慢，请稍后重试，或在管理员后台降低并发请求数。";
  }

  const detail = plainText || text.trim();
  return `${fallback}: ${status}${detail ? ` ${detail.slice(0, 220)}` : ""}`;
}

function normalizeImageItems(payload: unknown): ImageApiItem[] {
  const response = payload as ImageApiResponse;
  if (!Array.isArray(response.data)) {
    return [];
  }

  return response.data.filter((item) => item.b64_json || item.url);
}

async function materializeImageItem(item: ImageApiItem, signal?: AbortSignal): Promise<MaterializedImage> {
  if (item.b64_json) {
    return {
      bytes: new Uint8Array(Buffer.from(item.b64_json, "base64")),
      mimeType: "image/png",
    };
  }

  if (item.url) {
    return downloadImage(item.url, signal);
  }

  throw new Error("image-2 返回了无法识别的图片格式");
}

async function downloadImage(url: string, signal?: AbortSignal): Promise<MaterializedImage> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": IMAGE_USER_AGENT,
    },
    signal: requestSignal(signal),
  });

  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, mimeType: contentType };
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(appConfig.imageRequestTimeoutMs);
  if (!signal) {
    return timeoutSignal;
  }
  return AbortSignal.any([signal, timeoutSignal]);
}
