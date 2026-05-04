import { appConfig } from "../lib/config";
import { getDb, getImageConcurrencySetting } from "../lib/db";
import { processQueuedTasks } from "../lib/queue";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main(): Promise<void> {
  getDb();
  console.log("image worker started");

  while (true) {
    try {
      const concurrency = getImageConcurrencySetting();
      const processed = await processQueuedTasks(concurrency);
      if (processed > 0) {
        console.log(`processed ${processed} image task(s), concurrency=${concurrency}`);
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
