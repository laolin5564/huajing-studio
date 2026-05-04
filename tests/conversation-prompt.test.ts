import { describe, expect, test } from "bun:test";
import { composeConversationPrompt, normalizeConversationFixedPrompt } from "@/lib/conversation-prompt";
import { continueConversationSchema } from "@/lib/validation";

describe("conversation fixed prompt", () => {
  test("normalizes empty fixed prompts to null", () => {
    expect(normalizeConversationFixedPrompt("  ")).toBe(null);
    expect(normalizeConversationFixedPrompt("  统一白底主图  ")).toBe("统一白底主图");
  });

  test("composes fixed prompt with an optional per-message supplement", () => {
    const composed = composeConversationPrompt("把阴影更柔和", "统一白底电商主图");

    expect(composed.finalPrompt).toBe("统一白底电商主图\n\n本次补充：把阴影更柔和");
    expect(composed.fixedPrompt).toBe("统一白底电商主图");
    expect(composed.promptSuffix).toBe("把阴影更柔和");
    expect(composed.messageContent).toBe("把阴影更柔和");
  });

  test("allows an empty conversation message so the fixed prompt can drive the task", () => {
    const parsed = continueConversationSchema.parse({
      prompt: "",
      sourceImageId: "src_1",
    });

    expect(parsed.prompt).toBe("");
  });
});
