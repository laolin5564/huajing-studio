import { describe, expect, test } from "bun:test";
import { compareSemver, normalizeVersion } from "@/lib/version";

describe("version helpers", () => {
  test("normalizes leading v", () => {
    expect(normalizeVersion("v1.2.3")).toBe("1.2.3");
  });

  test("compares numeric semver segments", () => {
    expect(compareSemver("1.10.0", "1.2.0")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0", "1.0.1")).toBeLessThan(0);
    expect(compareSemver("v1.0", "1.0.0")).toBe(0);
  });

  test("orders prereleases below final releases", () => {
    expect(compareSemver("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
    expect(compareSemver("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
  });

  test("compares prerelease identifiers using semver precedence", () => {
    expect(compareSemver("1.0.0-beta.2", "1.0.0-beta.11")).toBeLessThan(0);
    expect(compareSemver("1.0.0-rc.1", "1.0.0-beta.11")).toBeGreaterThan(0);
  });
});
