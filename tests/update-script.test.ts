import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";

const repoRoot = path.resolve(".");
const updateScript = path.join(repoRoot, "scripts", "update.sh");

describe("update script backups", () => {
  test("backs up only existing env files", () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "canvas-realm-update-test-"));
    const backupDir = path.join(workspace, "backups");
    try {
      mkdirSync(path.join(workspace, "data"));
      writeFileSync(path.join(workspace, "data", "keep.txt"), "ok");
      writeFileSync(path.join(workspace, ".env"), "APP_BASE_URL=http://example.test\n");

      execFileSync("bash", [
        "-lc",
        `source ${shellQuote(updateScript)} && cd ${shellQuote(workspace)} && backup_runtime_files ${shellQuote(
          backupDir,
        )} fixed`,
      ]);

      expect(existsSync(path.join(backupDir, "data-fixed.tar.gz"))).toBe(true);
      expect(existsSync(path.join(backupDir, "env-fixed.tar.gz"))).toBe(true);
      expect(readdirSync(backupDir).length).toBe(2);
      const envArchiveEntries = execFileSync("tar", ["-tzf", path.join(backupDir, "env-fixed.tar.gz")]).toString();
      expect(envArchiveEntries).toContain(".env");
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });

  test("registers the deployed repo as a git safe directory", () => {
    const workspace = mkdtempSync(path.join(tmpdir(), "canvas-realm-safe-dir-test-"));
    const homeDir = path.join(workspace, "home");
    const repoDir = path.join(workspace, "repo");

    try {
      mkdirSync(homeDir);
      mkdirSync(repoDir);

      const safeDirectories = execFileSync("bash", [
        "-lc",
        `export HOME=${shellQuote(homeDir)} && source ${shellQuote(
          updateScript,
        )} && configure_git_safe_directory ${shellQuote(repoDir)} && git config --global --get-all safe.directory`,
      ]).toString();

      expect(safeDirectories.trim().split("\n")).toContain(repoDir);
    } finally {
      rmSync(workspace, { force: true, recursive: true });
    }
  });
});

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
