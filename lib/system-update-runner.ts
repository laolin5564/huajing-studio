import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appConfig } from "./config";

export type WebUpdateStatus = "idle" | "running" | "succeeded" | "failed";

export interface WebUpdateState {
  status: WebUpdateStatus;
  enabled: boolean;
  enabledReason: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  logs: string[];
  error: string | null;
  exitCode: number | null;
  scriptPath: string;
}

const maxLogLines = 400;
const scriptRelativePath = path.join("scripts", "web-update.sh");

let updateState: WebUpdateState = createIdleState();
let runningProcess: ReturnType<typeof spawn> | null = null;

function createIdleState(): WebUpdateState {
  const scriptPath = path.resolve(process.cwd(), scriptRelativePath);
  return {
    status: "idle",
    enabled: appConfig.webUpdateEnabled,
    enabledReason: appConfig.webUpdateEnabled ? null : "WEB_UPDATE_ENABLED 未设置为 true，Web 一键更新默认关闭。",
    startedAt: null,
    finishedAt: null,
    logs: [],
    error: null,
    exitCode: null,
    scriptPath,
  };
}

function refreshEnablement(): void {
  updateState.enabled = appConfig.webUpdateEnabled;
  updateState.enabledReason = appConfig.webUpdateEnabled
    ? null
    : "WEB_UPDATE_ENABLED 未设置为 true，Web 一键更新默认关闭。";
}

function appendLog(chunk: Buffer | string): void {
  const text = chunk.toString().replace(/\r\n/g, "\n");
  const lines = text.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) {
    return;
  }
  updateState.logs.push(...lines.map((line) => `[${new Date().toLocaleString("zh-CN", { hour12: false })}] ${line}`));
  if (updateState.logs.length > maxLogLines) {
    updateState.logs = updateState.logs.slice(-maxLogLines);
  }
}

function resolveScriptPath(): string {
  const cwd = process.cwd();
  const scriptPath = path.resolve(cwd, scriptRelativePath);
  const scriptsDir = path.resolve(cwd, "scripts");
  const realScriptPath = fs.realpathSync(scriptPath);
  const realScriptsDir = fs.realpathSync(scriptsDir);

  if (!realScriptPath.startsWith(`${realScriptsDir}${path.sep}`)) {
    throw new Error("更新脚本路径不在 scripts/ 目录内");
  }

  return realScriptPath;
}

export function getWebUpdateState(): WebUpdateState {
  refreshEnablement();
  return { ...updateState, logs: [...updateState.logs] };
}

export function runWebUpdate(): WebUpdateState {
  refreshEnablement();

  if (!updateState.enabled) {
    throw new Error(updateState.enabledReason ?? "Web 一键更新未启用");
  }

  if (runningProcess || updateState.status === "running") {
    throw new Error("已有更新任务正在执行，请等待当前任务完成");
  }

  const scriptPath = resolveScriptPath();
  const startedAt = new Date().toISOString();
  updateState = {
    status: "running",
    enabled: true,
    enabledReason: null,
    startedAt,
    finishedAt: null,
    logs: [`[${new Date().toLocaleString("zh-CN", { hour12: false })}] 开始执行 Web 一键更新脚本：${scriptRelativePath}`],
    error: null,
    exitCode: null,
    scriptPath,
  };

  const child = spawn("bash", [scriptPath], {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  runningProcess = child;

  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);

  child.on("error", (error) => {
    updateState.status = "failed";
    updateState.finishedAt = new Date().toISOString();
    updateState.error = error.message;
    appendLog(`启动更新脚本失败：${error.message}`);
    runningProcess = null;
  });

  child.on("close", (code) => {
    updateState.exitCode = code;
    updateState.finishedAt = new Date().toISOString();
    if (code === 0) {
      updateState.status = "succeeded";
      appendLog("Web 一键更新脚本执行完成。");
    } else {
      updateState.status = "failed";
      updateState.error = `更新脚本退出码：${code ?? "unknown"}`;
      appendLog(updateState.error);
    }
    runningProcess = null;
  });

  return getWebUpdateState();
}
