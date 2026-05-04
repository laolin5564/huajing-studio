import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageDepsJson = JSON.parse(readFileSync("package.deps.json", "utf8"));
const stableJson = (value: unknown) => JSON.stringify(value);

describe("package.deps.json", () => {
  test("keeps Docker dependency cache inputs in sync with package.json", () => {
    expect(stableJson(packageDepsJson.dependencies)).toBe(stableJson(packageJson.dependencies));
    expect(stableJson(packageDepsJson.devDependencies)).toBe(stableJson(packageJson.devDependencies));
    expect(stableJson(packageDepsJson.engines)).toBe(stableJson(packageJson.engines));
  });

  test("does not include release metadata that would invalidate the dependency cache", () => {
    expect("version" in packageDepsJson).toBe(false);
    expect("repository" in packageDepsJson).toBe(false);
    expect("bugs" in packageDepsJson).toBe(false);
    expect("homepage" in packageDepsJson).toBe(false);
  });
});
