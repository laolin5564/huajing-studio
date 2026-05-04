import { imageConcurrencyLimits } from "./types";

export function normalizeImageConcurrency(value: unknown, fallback: number = imageConcurrencyLimits.min): number {
  const numeric = Number(value);
  const candidate = Number.isFinite(numeric) ? Math.floor(numeric) : fallback;
  return Math.min(Math.max(candidate, imageConcurrencyLimits.min), imageConcurrencyLimits.max);
}
