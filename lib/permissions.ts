import { AuthError } from "./auth";
import {
  getConversation,
  getGeneratedImage,
  getGenerationTask,
  getSourceImage,
  getUserQuota,
} from "./db";
import type { ConversationRow, CurrentUser, GenerationTaskRow, GeneratedImageRow, SourceImageRow, TemplateRow } from "./types";

function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}

export function assertConversationAccess(user: CurrentUser, conversation: ConversationRow): void {
  if (isAdmin(user) || conversation.user_id === user.id) {
    return;
  }
  throw new AuthError("无权访问该会话", 403);
}

export function assertTaskAccess(user: CurrentUser, task: GenerationTaskRow): void {
  if (isAdmin(user) || task.user_id === user.id) {
    return;
  }
  if (task.conversation_id) {
    const conversation = getConversation(task.conversation_id);
    if (conversation?.user_id === user.id) {
      return;
    }
  }
  throw new AuthError("无权访问该任务", 403);
}

export function assertGeneratedImageAccess(user: CurrentUser, image: GeneratedImageRow): void {
  const task = getGenerationTask(image.task_id);
  if (!task) {
    throw new AuthError("图片所属任务不存在", 404);
  }
  assertTaskAccess(user, task);
}

export function assertSourceImageAccess(user: CurrentUser, image: SourceImageRow): void {
  if (isAdmin(user) || image.user_id === user.id) {
    return;
  }
  throw new AuthError("无权访问该参考图", 403);
}

export function assertImageReferenceAccess(user: CurrentUser, imageId: string): void {
  const generated = getGeneratedImage(imageId);
  if (generated) {
    assertGeneratedImageAccess(user, generated);
    return;
  }

  const source = getSourceImage(imageId);
  if (source) {
    assertSourceImageAccess(user, source);
    return;
  }

  throw new AuthError("参考图不存在或已无法访问", 400);
}

export function assertTemplateReadAccess(user: CurrentUser, template: TemplateRow): void {
  if (template.owner_user_id === null || isAdmin(user) || template.owner_user_id === user.id) {
    return;
  }
  throw new AuthError("无权访问该模板", 403);
}

export function assertTemplateManageAccess(user: CurrentUser, template: TemplateRow): void {
  if (template.owner_user_id === null) {
    if (isAdmin(user)) {
      return;
    }
    throw new AuthError("只有管理员可以管理平台模板", 403);
  }

  if (isAdmin(user) || template.owner_user_id === user.id) {
    return;
  }

  throw new AuthError("无权管理该模板", 403);
}

export function assertQuotaAvailable(user: CurrentUser, quantity: number): void {
  const quota = getUserQuota(user.id);
  if (quota.monthlyQuota === null) {
    return;
  }

  if (quota.monthUsed + quantity <= quota.monthlyQuota) {
    return;
  }

  throw new AuthError(
    `本月生成额度不足：已用 ${quota.monthUsed}，本次需要 ${quantity}，当前限额 ${quota.monthlyQuota}`,
    403,
  );
}
