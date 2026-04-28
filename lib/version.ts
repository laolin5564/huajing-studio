import packageJson from "@/package.json";

export const appVersion = packageJson.version;
export const defaultUpdateRepo = "laolin5564/huajing-studio";
export const defaultUpdateCheckUrl = `https://api.github.com/repos/${defaultUpdateRepo}/releases/latest`;

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

export function compareSemver(left: string, right: string): number {
  const leftParts = normalizeVersion(left).split(/[.+-]/)[0].split(".").map((part) => Number(part));
  const rightParts = normalizeVersion(right).split(/[.+-]/)[0].split(".").map((part) => Number(part));
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}
