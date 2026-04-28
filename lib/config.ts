import path from "node:path";

function resolvePathFromEnv(value: string | undefined, fallback: string): string {
  if (!value || value.trim() === "") {
    return path.resolve(process.cwd(), fallback);
  }

  if (value.startsWith("file:")) {
    const rawPath = value.slice("file:".length);
    return path.resolve(process.cwd(), rawPath);
  }

  return path.resolve(process.cwd(), value);
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const appConfig = {
  databasePath: resolvePathFromEnv(process.env.DATABASE_URL, "data/app.db"),
  imageStorageDir: resolvePathFromEnv(process.env.IMAGE_STORAGE_DIR, "data/images"),
  sub2apiBaseUrl: process.env.SUB2API_BASE_URL || "https://s2a.laolin.ai/v1",
  sub2apiApiKey: process.env.SUB2API_API_KEY || "",
  imageModel: process.env.IMAGE_MODEL || "gpt-image-2",
  imageRequestTimeoutMs: readNumberEnv("IMAGE_REQUEST_TIMEOUT_MS", 300_000),
  workerPollIntervalMs: readNumberEnv("WORKER_POLL_INTERVAL_MS", 3_000),
  costPerImage: readNumberEnv("COST_PER_IMAGE", 0.04),
};

export const IMAGE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const PUBLIC_FILE_PREFIX = "/api/files";
