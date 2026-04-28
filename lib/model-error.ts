import { openAIOAuthImageGenerationScope } from "./openai-oauth";

export function formatModelError(status: number, text: string, fallback: string): string {
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

  if (status === 401 && plainText.includes(openAIOAuthImageGenerationScope)) {
    return `OpenAI OAuth 不能直接调用官方 Platform 图片接口，缺少 ${openAIOAuthImageGenerationScope}。请确认服务已重启并使用 Codex Responses 图片工具桥接；如果仍失败，请切回 sub2api/API Key 模式。`;
  }

  const detail = plainText || text.trim();
  return `${fallback}: ${status}${detail ? ` ${detail.slice(0, 220)}` : ""}`;
}
