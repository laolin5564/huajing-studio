export interface OpenAIImageBridgeItem {
  b64_json?: string;
  mimeType?: string | null;
}

interface OpenAIResponsesImageResult {
  b64: string;
  outputFormat: string;
}

export function extractOpenAIOAuthImagesFromResponsesStream(text: string): OpenAIImageBridgeItem[] {
  const results: OpenAIResponsesImageResult[] = [];
  const pending: OpenAIResponsesImageResult[] = [];
  const seen = new Set<string>();
  let upstreamError = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) {
      continue;
    }
    const data = line.slice("data:".length).trim();
    if (!data || data === "[DONE]") {
      continue;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }
    if (!isRecord(payload)) {
      continue;
    }

    const payloadError = readNestedString(payload, ["error", "message"]) || readNestedString(payload, ["response", "error", "message"]);
    if (payloadError) {
      upstreamError = payloadError;
    }

    const type = readString(payload.type);
    if (type === "response.output_item.done") {
      const image = imageResultFromUnknown(payload.item);
      if (image) {
        appendImageResult(pending, seen, image);
      }
      continue;
    }

    if (type === "response.completed") {
      const output = isRecord(payload.response) ? payload.response.output : null;
      if (Array.isArray(output)) {
        for (const item of output) {
          const image = imageResultFromUnknown(item);
          if (image) {
            appendImageResult(results, seen, image);
          }
        }
      }
    }
  }

  if (results.length === 0 && pending.length > 0) {
    results.push(...pending);
  }
  if (results.length === 0 && upstreamError) {
    throw new Error(`OpenAI OAuth Codex Responses 返回错误：${upstreamError}`);
  }

  return results.map((item) => ({
    b64_json: item.b64,
    mimeType: openAIImageOutputMimeType(item.outputFormat),
  }));
}

function imageResultFromUnknown(value: unknown): OpenAIResponsesImageResult | null {
  if (!isRecord(value) || readString(value.type) !== "image_generation_call") {
    return null;
  }
  const b64 = readString(value.result).trim();
  if (!b64) {
    return null;
  }
  return {
    b64,
    outputFormat: readString(value.output_format),
  };
}

function appendImageResult(results: OpenAIResponsesImageResult[], seen: Set<string>, image: OpenAIResponsesImageResult): void {
  const key = `${image.outputFormat}|${image.b64}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  results.push(image);
}

function openAIImageOutputMimeType(outputFormat: string): string {
  const normalized = outputFormat.toLowerCase().trim();
  if (normalized.includes("/")) {
    return normalized;
  }
  if (normalized === "jpg" || normalized === "jpeg") {
    return "image/jpeg";
  }
  if (normalized === "webp") {
    return "image/webp";
  }
  return "image/png";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNestedString(value: unknown, pathParts: string[]): string {
  let cursor = value;
  for (const part of pathParts) {
    if (!isRecord(cursor)) {
      return "";
    }
    cursor = cursor[part];
  }
  return readString(cursor);
}
