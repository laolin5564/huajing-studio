import { deleteGeneratedImagesByIds, getImageRetentionDaysSetting, listExpiredGeneratedImages } from "./db";
import { deleteStorageFile } from "./storage";

export async function cleanupExpiredGeneratedImages(limit = 200): Promise<{
  enabled: boolean;
  deleted: number;
  retentionDays: number;
}> {
  const retentionDays = getImageRetentionDaysSetting();
  if (retentionDays <= 0) {
    return { enabled: false, deleted: 0, retentionDays };
  }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const expired = listExpiredGeneratedImages(cutoff, limit);
  if (expired.length === 0) {
    return { enabled: true, deleted: 0, retentionDays };
  }

  const deleted = deleteGeneratedImagesByIds(expired.map((image) => image.id));
  await Promise.all(deleted.map((image) => deleteStorageFile(image.file_path)));
  return { enabled: true, deleted: deleted.length, retentionDays };
}
