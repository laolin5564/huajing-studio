import { appConfig } from "../lib/config";
import { getDb, getImageConcurrencySetting } from "../lib/db";
import { cleanupExpiredGeneratedImages } from "../lib/image-cleanup";
import { processQueuedTasks } from "../lib/queue";

const cleanupIntervalMs = 60 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  getDb();
  console.log("image worker started");
  let lastCleanupAt = 0;

  while (true) {
    try {
      const concurrency = getImageConcurrencySetting();
      const processed = await processQueuedTasks(concurrency);
      if (processed > 0) {
        console.log(`processed ${processed} image task(s), concurrency=${concurrency}`);
      }
      if (Date.now() - lastCleanupAt > cleanupIntervalMs) {
        lastCleanupAt = Date.now();
        const cleanup = await cleanupExpiredGeneratedImages();
        if (cleanup.deleted > 0) {
          console.log(`cleaned ${cleanup.deleted} expired image(s), retention=${cleanup.retentionDays}d`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown worker error";
      console.error(message);
    }

    await sleep(appConfig.workerPollIntervalMs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
