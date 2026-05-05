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
      deleteUser,
      getCanvasProject,
      getConversationMessage,
      getGeneratedImage,
      getPublicAdminSettings,
      getRuntimeImageSettings,
      getUserById,
      getTemplate,
      listImages,
      listTemplates,
      listUserGroupsWithStats,
      listUsersPage,
      saveCanvasProject,
      saveImageProviderChannels,
      setAppSetting,
      toPublicCanvasProject,
      toPublicImage,
      toPublicTemplate,
      toPublicUser,
      updateUser,
    } = await import("../lib/db");
    const { defaultGroupIdForRegistration } = await import("../lib/auth");

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

    const savedCanvas = saveCanvasProject({
      userId: owner.id,
      name: "测试画布",
      snapshot: {
        document: {
          store: {
            "shape:test": { id: "shape:test", typeName: "shape", type: "image" },
          },
        },
        session: {},
      },
    });
    const publicCanvas = toPublicCanvasProject(getCanvasProject(owner.id));
    assert.equal(savedCanvas.user_id, owner.id);
    assert.equal(publicCanvas.name, "测试画布");
    assert.equal(typeof publicCanvas.snapshot, "object");

    const disabledOther = updateUser(other.id, { status: "disabled" });
    assert.equal(disabledOther.status, "disabled");
    assert.equal(toPublicUser(disabledOther).status, "disabled");

    const pagedUsers = listUsersPage({
      q: "template",
      status: "active",
      role: "member",
      groupId: group.id,
      page: 1,
      pageSize: 10,
      sort: "email",
      direction: "asc",
    });
    assert.equal(pagedUsers.pagination.total, 1);
    assert.equal(pagedUsers.users[0]?.email, "template-owner@example.test");
    assert.equal(pagedUsers.summary.total >= 2, true);

    const groupStats = listUserGroupsWithStats().find((item) => item.id === group.id);
    assert.equal(groupStats?.member_count, 2);
    assert.equal(groupStats?.active_member_count, 1);

    setAppSetting("registration_default_group_id", group.id);
    const registered = createUser({
      email: "registered-by-group@example.test",
      name: "Registered By Group",
      passwordHash: "hash",
      role: "member",
      groupId: defaultGroupIdForRegistration(),
      monthlyQuota: null,
    });
    assert.equal(registered.group_id, group.id);
    assert.equal(registered.monthly_quota, null);
    assert.equal(toPublicUser(registered).monthlyQuota, group.monthly_quota);

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

    const publicImage = listImages({
      userId: owner.id,
      isAdmin: true,
      mode: null,
      templateId: null,
      keyword: "删除图片",
      page: 1,
      pageSize: 10,
    }).map(toPublicImage)[0];
    assert.equal(publicImage?.userId, owner.id);
    assert.equal(publicImage?.userName, owner.name);
    assert.equal(publicImage?.userEmail, owner.email);

    const deleted = deleteGeneratedImagesByIds([image.id]);

    assert.equal(deleted.length, 1);
    assert.equal(getGeneratedImage(image.id), null);
    assert.equal(getConversationMessage(message.id)?.image_id, null);
    assert.equal(getTemplate(referencedTemplate.id)?.source_image_id, null);

    const deletedUser = deleteUser(other.id);
    assert.equal(deletedUser.id, other.id);
    assert.equal(getUserById(other.id), null);

    const savedChannels = saveImageProviderChannels([
      {
        id: "backup_channel",
        name: "备用线路",
        enabled: true,
        priority: 2,
        baseUrl: "https://backup.example.test/v1/",
        model: "gpt-image-2-backup",
        apiKey: "sk-backup",
      },
      {
        id: "main_channel",
        name: "主线路",
        enabled: true,
        priority: 1,
        baseUrl: "https://main.example.test/v1/",
        model: "gpt-image-2",
        apiKey: "sk-main",
      },
    ]);
    assert.equal(savedChannels[0].id, "main_channel");
    assert.equal(savedChannels[0].baseUrl, "https://main.example.test/v1");
    assert.equal(getRuntimeImageSettings().imageModel, "gpt-image-2");

    const publicChannels = getPublicAdminSettings().imageProviderChannels;
    assert.equal(publicChannels[0].apiKeyConfigured, true);

    const preservedChannels = saveImageProviderChannels([
      {
        id: "main_channel",
        name: "主线路",
        enabled: true,
        priority: 1,
        baseUrl: "https://main.example.test/v1",
        model: "gpt-image-2",
        apiKey: null,
      },
    ]);
    assert.equal(preservedChannels[0].apiKey, "sk-main");
    assert.throws(
      () =>
        saveImageProviderChannels([
          {
            id: "disabled_channel",
            name: "停用线路",
            enabled: false,
            priority: 1,
            baseUrl: "https://disabled.example.test/v1",
            model: "gpt-image-2",
            apiKey: "sk-disabled",
          },
        ]),
      /至少需要启用一个模型渠道/,
    );
  } finally {
    rmSync(workspace, { force: true, recursive: true });
  }
});
