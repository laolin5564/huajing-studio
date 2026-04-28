import {
  claimNextQueuedTask,
  createGeneratedImage,
  createId,
  getGenerationTask,
  getImageFilePathById,
  isTaskStopped,
  markTaskFailed,
  markTaskSucceeded,
} from "./db";
import { callImageModel } from "./sub2api";
import { parseSize, saveGeneratedImageFile } from "./storage";

export async function processNextQueuedTask(): Promise<boolean> {
  const task = claimNextQueuedTask();
  if (!task) {
    return false;
  }

  try {
    const sourceImagePath = task.source_image_id ? getImageFilePathById(task.source_image_id) : null;
    const generated = await runWithTaskCancellation(task.id, (signal) => callImageModel(task, sourceImagePath, signal));
    const current = getGenerationTask(task.id);
    if (!current || current.status !== "processing") {
      return true;
    }
    const { width, height } = parseSize(task.size);

    for (const item of generated) {
      const latest = getGenerationTask(task.id);
      if (!latest || latest.status !== "processing") {
        return true;
      }

      const imageId = createId("img");
      const filePath = await saveGeneratedImageFile({
        taskId: task.id,
        imageId,
        bytes: item.bytes,
        mimeType: item.mimeType,
      });

      createGeneratedImage({
        id: imageId,
        taskId: task.id,
        filePath,
        width,
        height,
        prompt: task.prompt,
        mode: task.mode,
        templateId: task.template_id,
      });
    }

    markTaskSucceeded(task.id, generated.length);
  } catch (error) {
    if (isTaskStopped(task.id)) {
      return true;
    }
    const message = error instanceof Error ? error.message : "生成任务处理失败";
    markTaskFailed(task.id, message);
  }

  return true;
}

export async function processQueuedTasks(maxTasks = 1): Promise<number> {
  const concurrency = Math.min(Math.max(Math.floor(maxTasks), 1), 8);
  const results = await Promise.all(Array.from({ length: concurrency }, () => processNextQueuedTask()));
  return results.filter(Boolean).length;
}

async function runWithTaskCancellation<T>(
  taskId: string,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setInterval(() => {
    const current = getGenerationTask(taskId);
    if (!current || current.status !== "processing") {
      controller.abort();
    }
  }, 500);

  try {
    return await operation(controller.signal);
  } finally {
    clearInterval(timer);
  }
}
