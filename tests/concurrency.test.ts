import { describe, expect, test } from "bun:test";
import { normalizeImageConcurrency } from "@/lib/concurrency";
import { createGenerationTaskSchema, updateAdminSettingsSchema } from "@/lib/validation";

describe("image concurrency", () => {
  test("normalizes configured concurrency to the supported range", () => {
    expect(normalizeImageConcurrency(0)).toBe(1);
    expect(normalizeImageConcurrency(1)).toBe(1);
    expect(normalizeImageConcurrency(100)).toBe(100);
    expect(normalizeImageConcurrency(101)).toBe(100);
    expect(normalizeImageConcurrency("bad", 2)).toBe(2);
  });

  test("admin settings accept up to 100 concurrent requests", () => {
    expect(updateAdminSettingsSchema.parse({ imageConcurrency: 100 }).imageConcurrency).toBe(100);
    let rejected = false;
    try {
      updateAdminSettingsSchema.parse({ imageConcurrency: 101 });
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  test("task-level low concurrency retry only accepts the safe override", () => {
    const parsed = createGenerationTaskSchema.parse({
      mode: "text_to_image",
      prompt: "测试低并发重试",
      requestedConcurrency: 1,
    });

    expect(parsed.requestedConcurrency).toBe(1);
    let rejected = false;
    try {
      createGenerationTaskSchema.parse({
        mode: "text_to_image",
        prompt: "测试高并发覆盖",
        requestedConcurrency: 2,
      });
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
