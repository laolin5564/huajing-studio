import { openAIOAuthImageGenerationScope } from "./openai-oauth";

export function cleanModelErrorText(text: string): string {
  return text
    .replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"[redacted]"')
    .replace(/"refresh_token"\s*:\s*"[^"]+"/gi, '"refresh_token":"[redacted]"')
    .replace(/"id_token"\s*:\s*"[^"]+"/gi, '"id_token":"[redacted]"')
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isModelTimeoutMessage(message: string): boolean {
  return /(?:模型接口超时|timeout|timed out|504|524|gateway time-out)/i.test(message);
}

export function formatModelError(status: number, text: string, fallback: string): string {
  const plainText = cleanModelErrorText(text);
  const lowerText = `${plainText} ${text}`.toLowerCase();

  if (status === 524 || status === 504 || /timeout occurred|gateway time-out|timed out/i.test(text)) {
    return `模型接口超时（${status}）：上游生成服务响应太慢。建议稍后重试，或在管理员后台降低并发请求数；如果走 Cloudflare/Nginx，也需要检查上游网关超时配置。`;
  }

  if (status === 413) {
    return "参考图请求体过大（413）：上传图片或多张参考图的总大小超过了模型网关限制。请压缩图片后重试，或在上游 Nginx 调高 client_max_body_size。";
  }

  if (status === 429) {
    return "模型接口限流（429）：当前请求过快或账号额度被限速。请稍后重试，或在管理员后台降低并发请求数。";
  }

  if (/(insufficient_quota|billing|balance|credit|quota|余额|额度不足|欠费)/i.test(lowerText)) {
    return "模型账号余额或额度不足：请检查模型服务账号余额、订阅状态或 API 额度。";
  }

  if (status === 404 || /(model_not_found|model .*not found|does not exist|模型不存在)/i.test(lowerText)) {
    return "模型不存在或接口地址不匹配：请检查管理员后台的 Base URL 与模型名称是否属于同一个服务。";
  }

  if (status === 401 && plainText.includes(openAIOAuthImageGenerationScope)) {
    return `OpenAI OAuth 不能直接调用官方 Platform 图片接口，缺少 ${openAIOAuthImageGenerationScope}。请确认服务已重启并使用 Codex Responses 图片工具桥接；如果仍失败，请切回 sub2api/API Key 模式。`;
  }

  if ((status === 401 || status === 403) && /(permission|scope|forbidden|unauthorized|无权限|权限不足)/i.test(lowerText)) {
    return `模型账号权限不足（${status}）：当前账号没有调用该图片模型的权限。请检查账号角色、授权范围或切换到可用的 API Key/OAuth 账号。`;
  }

  if (status === 401) {
    return "模型接口认证失败（401）：API Key 无效、已过期或没有配置到当前服务。请检查管理员后台的模型配置。";
  }

  if (status === 403) {
    return "模型接口拒绝访问（403）：当前账号或网关不允许调用该接口。请检查模型服务权限、IP 白名单或代理配置。";
  }

  if (status >= 500) {
    return `模型服务暂时不可用（${status}）：上游网关或模型服务返回错误。请稍后重试；如果持续出现，请检查 Base URL 后端服务状态。`;
  }

  const detail = plainText || text.trim();
  return `${fallback}: ${status}${detail ? ` ${detail.slice(0, 220)}` : ""}`;
}
