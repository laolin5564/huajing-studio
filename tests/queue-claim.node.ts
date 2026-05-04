import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

test("claimQueuedTasks claims multiple queued tasks in one worker batch", async () => {
  const workspace = mkdtempSync(path.join(tmpdir(), "canvas-realm-queue-claim-test-"));
  process.env.DATABASE_URL = path.join(workspace, "app.db");
  process.env.IMAGE_STORAGE_DIR = path.join(workspace, "images");

  try {
    const { claimQueuedTasks, createGenerationTask, listGenerationTasks } = await import("../lib/db");
    for (let index = 0; index < 4; index += 1) {
      createGenerationTask({
        userId: null,
        mode: "text_to_image",
        prompt: `队列并发测试 ${index + 1}`,
        negativePrompt: null,
        size: "auto",
        quantity: 1,
        templateId: null,
        sourceImageId: null,
        referenceStrength: 0.6,
        styleStrength: 0.7,
        applyFixedPrompt: false,
      });
    }

    const claimed = claimQueuedTasks(4);

    assert.equal(claimed.length, 4);
    assert.equal(new Set(claimed.map((task) => task.id)).size, 4);
    assert.equal(claimed.every((task) => task.status === "processing"), true);
    assert.equal(listGenerationTasks({ userId: "", isAdmin: true, statuses: ["queued"], limit: 10 }).length, 0);
    assert.equal(listGenerationTasks({ userId: "", isAdmin: true, statuses: ["processing"], limit: 10 }).length, 4);
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
});
