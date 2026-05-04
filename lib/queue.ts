import {
  claimQueuedTasks,
  createGeneratedImage,
  createId,
  getGenerationTask,
  getImageFilePathById,
  isTaskStopped,
  markTaskFailed,
  markTaskSucceeded,
  recordImageTimeoutFailure,
  resetImageTimeoutStreak,
  updateTaskProgressStage,
} from "./db";
import { normalizeImageConcurrency } from "./concurrency";
import { callImageModel } from "./image-provider";
import { isModelTimeoutMessage } from "./model-error";
import { parseSize, saveGeneratedImageFile } from "./storage";
import type { GenerationTaskRow } from "./types";

export async function processNextQueuedTask(): Promise<boolean> {
  const task = claimQueuedTasks(1)[0];
  if (!task) {
    return false;
  }

  await processClaimedTask(task);
  return true;
}

async function processClaimedTask(task: GenerationTaskRow): Promise<void> {
  try {
    let extraRefIds: string[] = [];
    try {
      extraRefIds = task.reference_image_ids ? JSON.parse(task.reference_image_ids) : [];
    } catch {
      // malformed JSON, treat as empty
    }
    const allRefIds = Array.from(
      new Set(
        [task.source_image_id, task.reference_image_id, ...extraRefIds].filter((id): id is string => Boolean(id)),
      ),
    );
    const sourceImagePaths = allRefIds
      .map((id) => getImageFilePathById(id))
      .filter((filePath): filePath is string => Boolean(filePath));
    updateTaskProgressStage(task.id, "generating");
    const generated = await runWithTaskCancellation(task.id, (signal) =>
      callImageModel(task, sourceImagePaths, signal),
    );
    const current = getGenerationTask(task.id);
    if (!current || current.status !== "processing") {
      return;
    }
    updateTaskProgressStage(task.id, "saving");
    const { width, height } = parseSize(task.size);

    for (const item of generated) {
      const latest = getGenerationTask(task.id);
      if (!latest || latest.status !== "processing") {
        return;
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
    resetImageTimeoutStreak();
  } catch (error) {
    if (isTaskStopped(task.id)) {
      return;
    }
    let message = error instanceof Error ? error.message : "生成任务处理失败";
    if (isModelTimeoutMessage(message)) {
      const timeout = recordImageTimeoutFailure();
      if (timeout.degraded) {
        message = `${message} 已连续 ${timeout.timeoutStreak} 次超时，系统已自动把并发请求数从 ${timeout.previousConcurrency} 降到 1。`;
      }
    } else {
      resetImageTimeoutStreak();
    }
    markTaskFailed(task.id, message);
  }
}

export async function processQueuedTasks(maxTasks = 1): Promise<number> {
  const concurrency = normalizeImageConcurrency(maxTasks);
  const tasks = claimQueuedTasks(concurrency);
  await Promise.all(tasks.map((task) => processClaimedTask(task)));
  return tasks.length;
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
