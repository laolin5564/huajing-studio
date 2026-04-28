import { describe, expect, test } from "bun:test";
import { extractOpenAIOAuthImagesFromResponsesStream } from "@/lib/openai-image-bridge";

describe("OpenAI OAuth image bridge", () => {
  test("extracts image_generation_call results from Codex Responses SSE", () => {
    const stream = [
      'data: {"type":"response.output_item.done","item":{"id":"ig_1","type":"image_generation_call","result":"aGVsbG8=","output_format":"webp"}}',
      "",
      'data: {"type":"response.completed","response":{"output":[]}}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    const images = extractOpenAIOAuthImagesFromResponsesStream(stream);

    expect(images.length).toBe(1);
    expect(images[0]?.b64_json).toBe("aGVsbG8=");
    expect(images[0]?.mimeType).toBe("image/webp");
  });
});
