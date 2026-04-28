import { describe, expect, test } from "bun:test";
import { formatModelError } from "@/lib/model-error";
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
});
