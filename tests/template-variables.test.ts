import { describe, expect, test } from "bun:test";
import { inspirationScenes, templateInspirations } from "@/lib/template-inspirations";
import { renderTemplatePrompt } from "@/lib/template-prompt";
import { createTemplateSchema } from "@/lib/validation";

describe("production template variables", () => {
  test("accepts configurable template fields", () => {
    const parsed = createTemplateSchema.parse({
      name: "电商主图",
      category: "platform",
      description: "填表生成电商主图",
      defaultPrompt: "为{产品名称}生成一张{背景风格}电商主图",
      defaultSize: "ecommerce_main_1_1",
      defaultReferenceStrength: 0.7,
      defaultStyleStrength: 0.65,
      templateVariables: [
        {
          key: "产品名称",
          label: "产品名称",
          type: "text",
          required: true,
          placeholder: "例如：便携榨汁杯",
          options: [],
        },
        {
          key: "背景风格",
          label: "背景风格",
          type: "select",
          defaultValue: "纯白背景",
          options: [
            { label: "纯白背景", value: "纯白背景" },
            { label: "浅灰摄影棚", value: "浅灰摄影棚" },
          ],
        },
      ],
    });

    expect(parsed.templateVariables.length).toBe(2);
    expect(parsed.templateVariables[0].required).toBe(true);
    expect(parsed.templateVariables[1].options[0].value).toBe("纯白背景");
  });

  test("omits empty optional variable segments from the final prompt", () => {
    const prompt = renderTemplatePrompt({
      id: "tpl_test",
      ownerUserId: null,
      scope: "platform",
      name: "公众号封面图",
      category: "platform",
      description: null,
      defaultPrompt:
        "生成一张公众号封面图，横版构图，比例约 2.35:1。文章主题：{文章主题}。标题文案：{标题文案}。品牌风格：{品牌风格}。画面克制专业，预留标题安全区。",
      defaultNegativePrompt: null,
      defaultSize: "wechat_cover_235_1",
      defaultReferenceStrength: 0.55,
      defaultStyleStrength: 0.68,
      sourceImageId: null,
      templateVariables: [],
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    }, {
      文章主题: "AI 图片工作流",
      标题文案: "",
      品牌风格: "理性科技",
    });

    expect(prompt).toBe(
      "生成一张公众号封面图，横版构图，比例约 2.35:1。文章主题：AI 图片工作流。品牌风格：理性科技。画面克制专业，预留标题安全区。",
    );
    expect(prompt.includes("{标题文案}")).toBe(false);
    expect(prompt.includes("标题文案：")).toBe(false);
  });

  test("covers every built-in inspiration scene with prompt breakdown", () => {
    const scenes = new Set(templateInspirations.map((inspiration) => inspiration.sceneCategory));

    expect(templateInspirations.length + 1).toBeGreaterThan(inspirationScenes.length);
    for (const scene of inspirationScenes) {
      expect(scenes.has(scene)).toBe(true);
    }

    for (const inspiration of templateInspirations) {
      expect(inspiration.effectDirection.length).toBeGreaterThan(8);
      expect(inspiration.breakdown.imageType.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.subject.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.scene.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.composition.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.lighting.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.material.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.copywriting.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.ratio.length).toBeGreaterThan(0);
      expect(inspiration.breakdown.pitfalls.length).toBeGreaterThan(2);
      expect(inspiration.draft.templateVariables.length).toBeGreaterThan(3);
    }
  });
});
