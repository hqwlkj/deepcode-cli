import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { DEFAULT_BASH_TIMEOUT_MS, clampBashTimeoutMs } from "../common/bash-timeout";
import { killProcessTree } from "../common/process-tree";
import type { ProcessTimeoutControl, ProcessTimeoutInfo, ToolExecutionContext, ToolExecutionResult } from "./executor";
import {
  buildDisableExtglobCommand,
  buildShellEnv,
  buildShellInitCommand,
  resolveShellPath,
  rewriteWindowsNullRedirect,
  toNativeCwd,
} from "../common/shell-utils";

const MAX_OUTPUT_CHARS = 30000;
const MAX_CAPTURE_CHARS = 10 * 1024 * 1024;
const sessionWorkingDirs = new Map<string, string>();

type ToolCommandResult = {
  ok: boolean;
  output: string;
  cwd: string | null;
  exitCode: number | null;
  signal: string | null;
  truncated: boolean;
  shellPath?: string;
  startCwd?: string;
  timedOut?: boolean;
  timeoutMs?: number;
  deadlineAt?: string;
};

export async function handleBashTool(
  args: Record<string, unknown>,
  context: ToolExecutionContext
): Promise<ToolExecutionResult> {
  const command = typeof args.command === "string" ? args.command : "";
  if (!command.trim()) {
    return {
      ok: false,
      name: "bash",
      error: 'Missing required "command" string.',
    };
  }

  const startCwd = getSessionCwd(context.sessionId, context.projectRoot);
  const { shellPath, shellArgs, marker } = buildShellCommand(command);

  // Track file changes BEFORE execution to capture correct pre-bash file state.
  // Must happen before executeShellCommand because destructive commands (rm, mv)
  // would remove or rename files before we can capture their content.
  const { warning: bashWarning, filePaths: trackedBashPaths } = trackBashFileChanges(command, startCwd, context);
  if (bashWarning) {
    context.onUntrackableBashCommand?.(command, bashWarning);
  }

  const execution = await executeShellCommand(shellPath, shellArgs, startCwd, command, context);

  // Capture after-content for files affected by the bash command so
  // the file-change tracker can compute a reverse diff.
  if (context.onFileChangeCompleted) {
    for (const filePath of trackedBashPaths) {
      const afterContent = fs.existsSync(filePath) ? tryReadFile(filePath) : null;
      context.onFileChangeCompleted({ filePath, afterContent });
    }
  }
  const result = buildToolCommandResult(
    execution.stdout,
    execution.stderr,
    marker,
    execution.exitCode,
    execution.signal,
    shellPath,
    startCwd,
    execution.timedOut,
    execution.timeoutMs,
    execution.deadlineAtMs
  );
  updateSessionCwd(context.sessionId, startCwd, result.cwd);

  if (execution.error || result.exitCode !== 0 || result.signal !== null) {
    const errorMessage = buildErrorMessage(result.exitCode, result.signal, execution.error, execution.timedOut);
    return formatResult({ ...result, ok: false }, "bash", errorMessage);
  }

  return formatResult(result, "bash");
}

function getSessionCwd(sessionId: string, fallback: string): string {
  return sessionWorkingDirs.get(sessionId) ?? fallback;
}

function updateSessionCwd(sessionId: string, fallback: string, cwd: string | null): void {
  const nextCwd = cwd ?? fallback;
  sessionWorkingDirs.set(sessionId, nextCwd);
}

function buildShellCommand(command: string): {
  shellPath: string;
  shellArgs: string[];
  marker: string;
} {
  const shellPath = resolveShellPath();
  const marker = buildMarker();
  const initCommand = buildShellInitCommand(shellPath);
  const disableExtglobCommand = buildDisableExtglobCommand(shellPath);
  const normalizedCommand = rewriteWindowsNullRedirect(command);
  const wrappedParts = [];
  if (initCommand) {
    wrappedParts.push(initCommand);
  }
  if (disableExtglobCommand) {
    wrappedParts.push(disableExtglobCommand);
  }
  wrappedParts.push(
    normalizedCommand,
    "__DEEPCODE_STATUS__=$?",
    `printf '%s%s\\n' "${marker}" "$PWD"`,
    "exit $__DEEPCODE_STATUS__"
  );
  const wrappedCommand = `{ ${wrappedParts.join("; ")}; } < /dev/null`;
  return { shellPath, shellArgs: ["-c", wrappedCommand], marker };
}

async function executeShellCommand(
  shellPath: string,
  shellArgs: string[],
  cwd: string,
  command: string,
  context: ToolExecutionContext
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  error?: string;
  timedOut: boolean;
  timeoutMs: number;
  deadlineAtMs: number;
}> {
  return new Promise((resolve) => {
    const detached = process.platform !== "win32";
    const configuredEnv = context.createOpenAIClient?.().env ?? {};
    const minTimeoutMs = context.bashMinTimeoutMs;
    const initialTimeoutMs = clampBashTimeoutMs(context.bashTimeoutMs ?? DEFAULT_BASH_TIMEOUT_MS, minTimeoutMs);
    const startedAtMs = Date.now();
    let timeoutMs = initialTimeoutMs;
    let deadlineAtMs = startedAtMs + timeoutMs;
    let timedOut = false;
    let settled = false;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    const child = spawn(shellPath, shellArgs, {
      cwd,
      env: buildShellEnv(shellPath, configuredEnv),
      detached,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const pid = child.pid;

    const getTimeoutInfo = (): ProcessTimeoutInfo => ({
      timeoutMs,
      startedAtMs,
      deadlineAtMs,
      timedOut,
    });
    const stopTimeoutTimer = () => {
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };
    const triggerTimeout = () => {
      if (settled || timedOut || typeof pid !== "number") {
        return;
      }
      timedOut = true;
      stopTimeoutTimer();
      killProcessTree(pid, "SIGKILL");
    };
    const scheduleTimeout = () => {
      stopTimeoutTimer();
      if (settled) {
        return;
      }
      const remainingMs = Math.max(0, deadlineAtMs - Date.now());
      timeoutTimer = setTimeout(triggerTimeout, remainingMs);
    };
    const timeoutControl: ProcessTimeoutControl = {
      getInfo: getTimeoutInfo,
      setTimeoutMs: (nextTimeoutMs) => {
        timeoutMs = clampBashTimeoutMs(nextTimeoutMs, minTimeoutMs);
        deadlineAtMs = startedAtMs + timeoutMs;
        if (deadlineAtMs <= Date.now()) {
          triggerTimeout();
        } else {
          scheduleTimeout();
        }
        return getTimeoutInfo();
      },
    };

    if (typeof pid === "number") {
      context.onProcessStart?.(pid, command);
      context.onProcessTimeoutControl?.(pid, timeoutControl);
      scheduleTimeout();
    }

    let stdout = "";
    let stderr = "";
    let error: string | undefined;

    child.stdout?.on("data", (chunk: string | Buffer) => {
      stdout = appendChunk(stdout, chunk);
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      context.onProcessStdout?.(pid as number, text);
    });
    child.stderr?.on("data", (chunk: string | Buffer) => {
      stderr = appendChunk(stderr, chunk);
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      context.onProcessStdout?.(pid as number, text);
    });

    child.on("error", (spawnError) => {
      error = spawnError.message;
    });

    child.on("close", (code, signal) => {
      settled = true;
      stopTimeoutTimer();
      if (typeof pid === "number") {
        context.onProcessTimeoutControl?.(pid, null);
        context.onProcessExit?.(pid);
      }
      resolve({
        stdout,
        stderr,
        exitCode: typeof code === "number" ? code : null,
        signal: signal ?? null,
        error,
        timedOut,
        timeoutMs,
        deadlineAtMs,
      });
    });
  });
}

function appendChunk(existing: string, chunk: string | Buffer): string {
  if (existing.length >= MAX_CAPTURE_CHARS) {
    return existing;
  }
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  const remaining = MAX_CAPTURE_CHARS - existing.length;
  return `${existing}${text.slice(0, remaining)}`;
}

function buildMarker(): string {
  const token = Math.random().toString(36).slice(2);
  return `__DEEPCODE_PWD__${token}__`;
}

function buildToolCommandResult(
  stdout: string,
  stderr: string,
  marker: string,
  exitCode: number | null,
  signal: string | null,
  shellPath: string,
  startCwd: string,
  timedOut: boolean = false,
  timeoutMs?: number,
  deadlineAtMs?: number
): ToolCommandResult {
  const { output: cleanedStdout, cwd } = stripMarker(stdout, marker);
  const combined = joinOutput(cleanedStdout, stderr);
  const { text, truncated } = truncateOutput(combined);
  return {
    ok: exitCode === 0 && signal === null,
    output: text,
    cwd,
    exitCode,
    signal,
    truncated,
    shellPath,
    startCwd,
    timedOut,
    timeoutMs,
    deadlineAt: typeof deadlineAtMs === "number" ? new Date(deadlineAtMs).toISOString() : undefined,
  };
}

function stripMarker(stdout: string, marker: string): { output: string; cwd: string | null } {
  if (!stdout) {
    return { output: "", cwd: null };
  }

  const lines = stdout.split(/\r?\n/);
  let markerIndex = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].startsWith(marker)) {
      markerIndex = i;
      break;
    }
  }

  if (markerIndex === -1) {
    return { output: stdout, cwd: null };
  }

  const markerLine = lines[markerIndex];
  const shellCwd = markerLine.slice(marker.length).trim();
  const cwd = shellCwd ? toNativeCwd(shellCwd) : null;
  lines.splice(markerIndex, 1);
  return { output: lines.join("\n"), cwd };
}

function joinOutput(stdout: string, stderr: string): string {
  const trimmedStdout = stdout ?? "";
  const trimmedStderr = stderr ?? "";
  if (trimmedStdout && trimmedStderr) {
    return `${trimmedStdout}\n${trimmedStderr}`;
  }
  return trimmedStdout || trimmedStderr;
}

function truncateOutput(output: string): { text: string; truncated: boolean } {
  if (output.length <= MAX_OUTPUT_CHARS) {
    return { text: output, truncated: false };
  }
  return { text: output.slice(0, MAX_OUTPUT_CHARS), truncated: true };
}

function buildErrorMessage(exitCode: number | null, signal: string | null, error?: string, timedOut = false): string {
  if (error) {
    return error;
  }
  if (timedOut) {
    return "Command timed out.";
  }
  if (signal) {
    return `Command terminated by signal ${signal}.`;
  }
  if (exitCode !== null) {
    return `Command failed with exit code ${exitCode}.`;
  }
  return "Command failed.";
}

/**
 * Detect and track common file operations in a bash command for /rewind rollback.
 * Handles: rm, mv, touch, cp. File paths are resolved against the working directory.
 *
 * @returns A warning string if the command is untrackable (e.g. package installation),
 *          or null if tracking succeeded or the command is benign.
 */
function trackBashFileChanges(
  command: string,
  cwd: string,
  context: ToolExecutionContext
): {
  warning: string | null;
  filePaths: string[];
} {
  const filePaths: string[] = [];

  if (!context.onFileChange) {
    return { warning: null, filePaths };
  }

  const trimmed = command.trim();

  // rm <files...>
  const rmMatch = trimmed.match(/^rm\s+(?:-r?f?\s+)*(.+)$/);
  if (rmMatch) {
    const fileParts = rmMatch[1].split(/\s+/);
    for (const part of fileParts) {
      const cleanPart = part.replace(/["']/g, "").trim();
      if (!cleanPart) continue;
      const absPath = resolvePath(cleanPart, cwd);
      if (!absPath) continue;
      filePaths.push(absPath);
      const exists = fs.existsSync(absPath);
      context.onFileChange!({
        type: "delete",
        filePath: absPath,
        previousContent: exists ? tryReadFile(absPath) : null,
        previousExists: exists,
      });
    }
    return { warning: null, filePaths };
  }

  // mv <source> <dest>
  const mvMatch = trimmed.match(/^mv\s+(?:-[a-zA-Z]*\s+)*([^\s]+)\s+([^\s]+)$/);
  if (mvMatch) {
    const source = mvMatch[1].replace(/["']/g, "").trim();
    const dest = mvMatch[2].replace(/["']/g, "").trim();
    const sourcePath = resolvePath(source, cwd);
    const destPath = resolvePath(dest, cwd);
    if (sourcePath) {
      filePaths.push(sourcePath);
      const sourceExisted = fs.existsSync(sourcePath);
      context.onFileChange!({
        type: "delete",
        filePath: sourcePath,
        previousContent: sourceExisted ? tryReadFile(sourcePath) : null,
        previousExists: sourceExisted,
      });
    }
    if (destPath) {
      filePaths.push(destPath);
      const destExisted = fs.existsSync(destPath);
      context.onFileChange!({
        type: destExisted ? "modify" : "create",
        filePath: destPath,
        previousContent: destExisted ? tryReadFile(destPath) : null,
        previousExists: destExisted,
      });
    }
    return { warning: null, filePaths };
  }

  // touch <files...>
  const touchMatch = trimmed.match(/^touch\s+(.+)$/);
  if (touchMatch) {
    const fileParts = touchMatch[1].split(/\s+/);
    for (const part of fileParts) {
      const cleanPart = part.replace(/["']/g, "").trim();
      if (!cleanPart) continue;
      const absPath = resolvePath(cleanPart, cwd);
      if (!absPath) continue;
      filePaths.push(absPath);
      const existed = fs.existsSync(absPath);
      context.onFileChange!({
        type: existed ? "modify" : "create",
        filePath: absPath,
        previousContent: existed ? tryReadFile(absPath) : null,
        previousExists: existed,
      });
    }
    return { warning: null, filePaths };
  }

  // cp <source> <dest>
  const cpMatch = trimmed.match(/^cp\s+(?:-[a-zA-Z]*\s+)*([^\s]+)\s+([^\s]+)$/);
  if (cpMatch) {
    const dest = cpMatch[2].replace(/["']/g, "").trim();
    const destPath = resolvePath(dest, cwd);
    if (destPath) {
      filePaths.push(destPath);
      const destExisted = fs.existsSync(destPath);
      context.onFileChange!({
        type: destExisted ? "modify" : "create",
        filePath: destPath,
        previousContent: destExisted ? tryReadFile(destPath) : null,
        previousExists: destExisted,
      });
    }
    return { warning: null, filePaths };
  }

  // Check if the command is an untrackable operation and return a warning.
  const warning = classifyUntrackable(trimmed);
  return { warning, filePaths };
}

/**
 * Classify a bash command that doesn't match known file-operation patterns.
 * Returns a human-readable warning if the command is an untrackable operation
 * (e.g. package installation, service management), or null if benign.
 */
function classifyUntrackable(command: string): string | null {
  const firstWord = command.split(/\s+/)[0] ?? "";
  const lowerCmd = command.toLowerCase();

  // Package managers — install/remove/uninstall operations
  const pkgManagers: Array<{ pattern: RegExp; label: string }> = [
    {
      pattern: /\bapt(?:-get)?\s+(?:install|remove|purge|upgrade|dist-upgrade|full-upgrade)\b/,
      label: "apt install/remove",
    },
    {
      pattern: /\bnpm\s+(?:install|uninstall|update|add|remove)\s+(?:-[gs]\s+)?(?!.*--save-dev\b)/,
      label: "npm install (global)",
    },
    { pattern: /\byarn\s+(?:global\s+)?(?:add|remove|upgrade)\b/, label: "yarn add/remove" },
    { pattern: /\bpnpm\s+(?:add|remove|install|update)\b/, label: "pnpm add/remove" },
    { pattern: /\bpip\d*\s+(?:install|uninstall)\b/, label: "pip install/uninstall" },
    { pattern: /\bpipenv\s+install\b/, label: "pipenv install" },
    { pattern: /\bbrew\s+(?:install|uninstall|upgrade|reinstall)\b/, label: "brew install/uninstall" },
    { pattern: /\byum\s+(?:install|remove|update|upgrade)\b/, label: "yum install/remove" },
    { pattern: /\bdnf\s+(?:install|remove|update|upgrade)\b/, label: "dnf install/remove" },
    { pattern: /\bpacman\s+(?:-[A-Za-z]*S|[A-Za-z]*R)\b/, label: "pacman install/remove" },
    { pattern: /\bzypper\s+(?:install|remove|update)\b/, label: "zypper install/remove" },
    { pattern: /\bchoco\s+(?:install|uninstall|upgrade)\b/, label: "choco install/uninstall" },
    { pattern: /\bcomposer\s+(?:global\s+)?(?:require|install|update|remove)\b/, label: "composer require/install" },
    { pattern: /\bgem\s+install\b/, label: "gem install" },
    { pattern: /\bcargo\s+install\b/, label: "cargo install" },
    { pattern: /\bgo\s+(?:get|install)\b/, label: "go get/install" },
    { pattern: /\bflatpak\s+install\b/, label: "flatpak install" },
    { pattern: /\bsnap\s+install\b/, label: "snap install" },
    { pattern: /\bwinget\s+install\b/, label: "winget install" },
  ];

  for (const { pattern, label } of pkgManagers) {
    if (pattern.test(lowerCmd)) {
      return `Package installation/removal (${label}) cannot be automatically rolled back`;
    }
  }

  // Service / daemon management
  if (/\b(systemctl|service|launchctl|rc-service|sv|chkconfig|update-rc\.d)\s+/.test(lowerCmd)) {
    return `Service/daemon management (${firstWord}) cannot be automatically rolled back`;
  }

  // Database operations
  if (
    /\b(mysql|psql|mongo|mongosh|redis-cli|sqlite3)\s+/.test(lowerCmd) &&
    !/\b(mysql|psql|mongo|mongosh|redis-cli|sqlite3)\s+--version\b/.test(lowerCmd)
  ) {
    return `Database operation (${firstWord}) cannot be automatically rolled back`;
  }

  // Docker operations that modify system state
  if (/\bdocker\s+(run|pull|build|push|rmi|compose\s+(?:up|down|build|pull))\b/.test(lowerCmd)) {
    return `Docker operation (${firstWord}) cannot be automatically rolled back`;
  }

  // Running scripts or remote scripts
  if (
    /\b(curl|wget)\s+.*\|\s*(?:bash|sh|zsh)\b/.test(lowerCmd) ||
    /\b(curl|wget)\s+.*\|\s*(?:sudo\s+)?(?:bash|sh|zsh)\b/.test(lowerCmd)
  ) {
    return `Remote script execution (${firstWord} | sh) cannot be automatically rolled back`;
  }

  return null;
}

function resolvePath(fileSpec: string, cwd: string): string | null {
  if (!fileSpec) return null;
  // Skip glob patterns
  if (fileSpec.includes("*") || fileSpec.includes("?")) return null;
  if (path.isAbsolute(fileSpec)) return fileSpec;
  return path.join(cwd, fileSpec);
}

function tryReadFile(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 1_000_000) return null; // Skip large files
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function formatResult(result: ToolCommandResult, name: string, errorMessage?: string): ToolExecutionResult {
  const metadata: Record<string, unknown> = {
    exitCode: result.exitCode,
    signal: result.signal,
    cwd: result.cwd,
    truncated: result.truncated,
    shellPath: result.shellPath,
    startCwd: result.startCwd,
  };
  if (typeof result.timedOut === "boolean") {
    metadata.timedOut = result.timedOut;
  }
  if (typeof result.timeoutMs === "number") {
    metadata.timeoutMs = result.timeoutMs;
  }
  if (result.deadlineAt) {
    metadata.deadlineAt = result.deadlineAt;
  }

  const outputValue = result.output ? result.output : undefined;

  return {
    ok: result.ok,
    name,
    output: outputValue,
    error: errorMessage,
    metadata,
  };
}
