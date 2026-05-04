import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

test("data management keeps template scope and image deletion references consistent", async () => {
  const workspace = mkdtempSync(path.join(tmpdir(), "canvas-realm-data-management-test-"));
  process.env.DATABASE_URL = path.join(workspace, "app.db");
  process.env.IMAGE_STORAGE_DIR = path.join(workspace, "images");

  try {
    const {
      createConversation,
      createConversationMessage,
      createGeneratedImage,
      createGenerationTask,
      createTemplate,
      createUser,
      createUserGroup,
      deleteGeneratedImagesByIds,
      getConversationMessage,
      getGeneratedImage,
      getTemplate,
      listTemplates,
      toPublicTemplate,
    } = await import("../lib/db");

    const group = createUserGroup({ name: "数据管理测试分组", monthlyQuota: 100 });
    const owner = createUser({
      email: "template-owner@example.test",
      name: "Template Owner",
      passwordHash: "hash",
      role: "member",
      groupId: group.id,
      monthlyQuota: null,
    });
    const other = createUser({
      email: "template-other@example.test",
      name: "Template Other",
      passwordHash: "hash",
      role: "member",
      groupId: group.id,
      monthlyQuota: null,
    });

    const platform = createTemplate({
      ownerUserId: null,
      name: "平台模板测试",
      category: "platform",
      description: null,
      defaultPrompt: "平台模板 prompt",
      defaultNegativePrompt: null,
      defaultSize: "auto",
      defaultReferenceStrength: 0.6,
      defaultStyleStrength: 0.7,
      sourceImageId: null,
    });
    const userTemplate = createTemplate({
      ownerUserId: owner.id,
      name: "用户模板测试",
      category: "company",
      description: null,
      defaultPrompt: "用户模板 prompt",
      defaultNegativePrompt: null,
      defaultSize: "auto",
      defaultReferenceStrength: 0.6,
      defaultStyleStrength: 0.7,
      sourceImageId: null,
    });

    const ownerTemplates = listTemplates({ userId: owner.id }).map((template) => template.id);
    const otherTemplates = listTemplates({ userId: other.id }).map((template) => template.id);

    assert.equal(ownerTemplates.includes(platform.id), true);
    assert.equal(ownerTemplates.includes(userTemplate.id), true);
    assert.equal(otherTemplates.includes(platform.id), true);
    assert.equal(otherTemplates.includes(userTemplate.id), false);
    assert.equal(toPublicTemplate(userTemplate).scope, "user");
    assert.equal(toPublicTemplate(platform).scope, "platform");

    const conversation = createConversation("删除图片测试", owner.id);
    const task = createGenerationTask({
      userId: owner.id,
      conversationId: conversation.id,
      mode: "text_to_image",
      prompt: "删除图片时清理引用",
      negativePrompt: null,
      size: "auto",
      quantity: 1,
      templateId: null,
      sourceImageId: null,
      referenceStrength: 0.6,
      styleStrength: 0.7,
      applyFixedPrompt: false,
    });
    const image = createGeneratedImage({
      id: "img_delete_reference_test",
      taskId: task.id,
      filePath: "2026/05/04/task_delete/img_delete_reference_test.png",
      width: 1024,
      height: 1024,
      prompt: task.prompt,
      mode: task.mode,
      templateId: null,
    });
    const message = createConversationMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: "生成完成",
      taskId: task.id,
      imageId: image.id,
    });
    const referencedTemplate = createTemplate({
      ownerUserId: owner.id,
      name: "图片引用模板",
      category: "company",
      description: null,
      defaultPrompt: image.prompt,
      defaultNegativePrompt: null,
      defaultSize: "auto",
      defaultReferenceStrength: 0.6,
      defaultStyleStrength: 0.7,
      sourceImageId: image.id,
    });

    const deleted = deleteGeneratedImagesByIds([image.id]);

    assert.equal(deleted.length, 1);
    assert.equal(getGeneratedImage(image.id), null);
    assert.equal(getConversationMessage(message.id)?.image_id, null);
    assert.equal(getTemplate(referencedTemplate.id)?.source_image_id, null);
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
});
