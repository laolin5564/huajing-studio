import { describe, expect, test } from "bun:test";
import { buildPromptOptimizerUserPrompt, extractOptimizedPrompt } from "@/lib/prompt-optimizer";

describe("prompt optimizer", () => {
  test("omits empty template variables from optimizer context", () => {
    const prompt = buildPromptOptimizerUserPrompt({
      prompt: "生成一张公众号封面图",
      mode: "text_to_image",
      sizeLabel: "公众号封面 2.35:1",
      templateName: "公众号封面图",
      templateDescription: "横版封面",
      variables: {
        文章主题: "AI 图片工作流",
        标题文案: "",
        品牌风格: "理性科技",
      },
    });

    expect(prompt.includes("文章主题: AI 图片工作流")).toBe(true);
    expect(prompt.includes("品牌风格: 理性科技")).toBe(true);
    expect(prompt.includes("标题文案:")).toBe(false);
  });

  test("extracts JSON prompt from model payloads", () => {
    expect(extractOptimizedPrompt({
      output_text: "{\"prompt\":\"优化后的提示词\"}",
    })).toBe("优化后的提示词");

    expect(extractOptimizedPrompt({
      choices: [{ message: { content: "```json\n{\"prompt\":\"聊天接口提示词\"}\n```" } }],
    })).toBe("聊天接口提示词");
  });
});
