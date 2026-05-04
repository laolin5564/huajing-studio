import { describe, expect, test } from "bun:test";
import { formatModelError, isModelTimeoutMessage } from "@/lib/model-error";
import { openAIOAuthImageGenerationScope } from "@/lib/openai-oauth";

describe("model error formatting", () => {
  test("explains missing OAuth image permission clearly", () => {
    const message = formatModelError(
      401,
      JSON.stringify({
        error: {
          message: `You have insufficient permissions for this operation. Missing scopes: ${openAIOAuthImageGenerationScope}.`,
        },
      }),
      "image generation failed",
    );

    expect(message).toContain("OpenAI OAuth 不能直接调用官方 Platform 图片接口");
    expect(message).toContain(openAIOAuthImageGenerationScope);
    expect(message).toContain("Codex Responses 图片工具桥接");
  });

  test("classifies upstream gateway timeout", () => {
    const message = formatModelError(504, "504 Gateway Time-out nginx/1.24.0", "image edit failed");
    expect(message).toContain("模型接口超时（504）");
    expect(isModelTimeoutMessage(message)).toBe(true);
  });

  test("explains oversized image edit requests", () => {
    const message = formatModelError(413, "413 Request Entity Too Large nginx/1.24.0", "image edit failed");
    expect(message).toContain("参考图请求体过大（413）");
    expect(message).toContain("client_max_body_size");
  });

  test("classifies missing balance or quota", () => {
    const message = formatModelError(
      401,
      JSON.stringify({ error: { message: "You have insufficient quota. Please check your billing details." } }),
      "image generation failed",
    );
    expect(message).toContain("模型账号余额或额度不足");
  });
});
