import { describe, expect, test } from "bun:test";
import { modeLabels } from "@/components/client-api";
import { listImagesQuerySchema } from "@/lib/validation";

describe("generation modes", () => {
  test("legacy edit mode is presented as image-to-image", () => {
    expect(modeLabels.edit_image).toBe("图生图");
  });

  test("legacy edit image history filters map to image-to-image", () => {
    const parsed = listImagesQuerySchema.parse({ mode: "edit_image" });
    expect(parsed.mode).toBe("image_to_image");
  });
});
