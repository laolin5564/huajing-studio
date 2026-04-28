import packageJson from "../package.json";

export const appVersion = packageJson.version;
export const defaultUpdateRepo = "laolin5564/huajing-studio";
export const defaultUpdateCheckUrl = `https://api.github.com/repos/${defaultUpdateRepo}/releases/latest`;

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

function parseSemver(version: string): ParsedSemver {
  const normalized = normalizeVersion(version);
  const match = normalized.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0, prerelease: [] };
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) {
    return 0;
  }
  if (left.length === 0) {
    return 1;
  }
  if (right.length === 0) {
    return -1;
  }

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }

    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) {
      if (leftNumber !== rightNumber) {
        return leftNumber > rightNumber ? 1 : -1;
      }
      continue;
    }
    if (leftNumber !== null) {
      return -1;
    }
    if (rightNumber !== null) {
      return 1;
    }
    if (leftPart !== rightPart) {
      return leftPart > rightPart ? 1 : -1;
    }
  }

  return 0;
}

export function compareSemver(left: string, right: string): number {
  const leftParsed = parseSemver(left);
  const rightParsed = parseSemver(right);
  const numericKeys = ["major", "minor", "patch"] as const;

  for (const key of numericKeys) {
    const leftValue = leftParsed[key];
    const rightValue = rightParsed[key];
    if (leftValue > rightValue) {
      return 1;
    }
    if (leftValue < rightValue) {
      return -1;
    }
  }

  return comparePrerelease(leftParsed.prerelease, rightParsed.prerelease);
}
