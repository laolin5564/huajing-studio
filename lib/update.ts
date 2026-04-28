import { appConfig } from "@/lib/config";
import { appVersion, compareSemver, normalizeVersion } from "@/lib/version";

export interface SystemUpdateInfo {
  currentVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  publishedAt: string | null;
  releaseNotesUrl: string | null;
  releaseName: string | null;
  updateAvailable: boolean;
  updateCheckUrl: string;
  updateRepo: string;
  updateCommand: string;
  checkedAt: string;
}

interface GitHubReleasePayload {
  tag_name?: unknown;
  name?: unknown;
  html_url?: unknown;
  published_at?: unknown;
}

function ensureString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function buildUpdateCommand(): string {
  return "WEB_UPDATE_ENABLED=true bash scripts/web-update.sh";
}

function validateUpdateCheckUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error("更新源必须使用 HTTPS 地址");
  }
  return url;
}

function updateCheckSignal(): AbortSignal | undefined {
  return typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(10_000) : undefined;
}

export async function checkSystemUpdate(): Promise<SystemUpdateInfo> {
  const updateUrl = validateUpdateCheckUrl(appConfig.updateCheckUrl);
  const response = await fetch(updateUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `huajing-studio/${appVersion}`,
    },
    cache: "no-store",
    signal: updateCheckSignal(),
  });

  if (!response.ok) {
    throw new Error(`检查更新失败：更新源返回 HTTP ${response.status}`);
  }

  const payload = (await response.json()) as GitHubReleasePayload;
  const tag = ensureString(payload.tag_name);
  if (!tag) {
    throw new Error("检查更新失败：更新源没有返回 release tag");
  }

  const latestVersion = normalizeVersion(tag);

  return {
    currentVersion: appVersion,
    latestVersion,
    latestTag: tag,
    publishedAt: ensureString(payload.published_at),
    releaseNotesUrl: ensureString(payload.html_url),
    releaseName: ensureString(payload.name),
    updateAvailable: compareSemver(latestVersion, appVersion) > 0,
    updateCheckUrl: appConfig.updateCheckUrl,
    updateRepo: appConfig.updateRepo,
    updateCommand: buildUpdateCommand(),
    checkedAt: new Date().toISOString(),
  };
}

export function getSystemUpdateFallbackInfo(): SystemUpdateInfo {
  return {
    currentVersion: appVersion,
    latestVersion: null,
    latestTag: null,
    publishedAt: null,
    releaseNotesUrl: null,
    releaseName: null,
    updateAvailable: false,
    updateCheckUrl: appConfig.updateCheckUrl,
    updateRepo: appConfig.updateRepo,
    updateCommand: buildUpdateCommand(),
    checkedAt: new Date().toISOString(),
  };
}
