import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

export type FileChangeType = "create" | "modify" | "delete";

export type FileChange = {
  type: FileChangeType;
  filePath: string;
  previousContent?: string | null;
  previousExists: boolean;
  previousHash?: string;
};

export type FileChangeRecord = {
  messageId: string;
  toolCallId: string;
  toolName: string;
  timestamp: string;
  changes: FileChange[];
};

/** An untrackable bash operation that cannot be rolled back. */
export type UntrackableCommand = {
  messageId: string;
  toolCallId: string;
  command: string;
  reason: string;
};

const MAX_FILE_CONTENT_SIZE = 1_000_000; // 1 MB

/** JSON shape persisted to disk. */
export type FileChangeTrackerData = {
  version: 1;
  sessionId: string;
  changes: FileChangeRecord[];
  untrackableCommands: UntrackableCommand[];
};

/**
 * Tracks file changes across tool executions within a session,
 * enabling rollback of file system state during /rewind.
 */
export class FileChangeTracker {
  private readonly changes: FileChangeRecord[] = [];
  private readonly untrackableCommands: UntrackableCommand[] = [];

  /**
   * Record file changes from a tool execution. Called before the tool
   * modifies files so previous state can be captured.
   */
  recordChange(messageId: string, toolCallId: string, toolName: string, change: FileChange): void {
    // Deduplicate: same file in the same message => merge by keeping the first previousContent
    const existingRecord = this.findExistingRecord(messageId, change.filePath);
    if (existingRecord) {
      // Don't overwrite previousContent if it was already captured
      if (!existingRecord.previousContent && change.previousContent) {
        existingRecord.previousContent = change.previousContent;
      }
      existingRecord.type = change.type;
      return;
    }

    this.changes.push({
      messageId,
      toolCallId,
      toolName,
      timestamp: new Date().toISOString(),
      changes: [change],
    });
  }

  private findExistingRecord(messageId: string, filePath: string): FileChange | undefined {
    for (const record of this.changes) {
      if (record.messageId !== messageId) continue;
      for (const change of record.changes) {
        if (normalizePath(change.filePath) === normalizePath(filePath)) {
          return change;
        }
      }
    }
    return undefined;
  }

  /**
   * Get file change records associated with any message that appears
   * after the given index in the messages array.
   */
  getChangesAfter(messageIndex: number, messages: { id: string }[]): FileChangeRecord[] {
    const afterIds = new Set(messages.slice(messageIndex + 1).map((m) => m.id));
    if (afterIds.size === 0) return [];
    return this.changes.filter((r) => afterIds.has(r.messageId));
  }

  /**
   * Capture the previous state of a file before modification.
   * Returns the FileChange that describes the snapshot taken.
   */
  captureBeforeChange(
    messageId: string,
    toolCallId: string,
    toolName: string,
    filePath: string,
    _actionType: "write" | "edit"
  ): FileChange {
    const exists = fs.existsSync(filePath);
    const change: FileChange = {
      type: exists ? "modify" : "create",
      filePath,
      previousExists: exists,
    };

    if (exists) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size <= MAX_FILE_CONTENT_SIZE) {
          change.previousContent = fs.readFileSync(filePath, "utf8");
        }
      } catch {
        // If we can't read it, we can at least note it existed
      }
    }

    this.recordChange(messageId, toolCallId, toolName, change);
    return change;
  }

  /**
   * Record a file deletion caused by a bash command.
   */
  recordDelete(messageId: string, toolCallId: string, filePath: string): void {
    const exists = fs.existsSync(filePath);
    const change: FileChange = {
      type: "delete",
      filePath,
      previousExists: exists,
    };

    if (exists) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.size <= MAX_FILE_CONTENT_SIZE) {
          change.previousContent = fs.readFileSync(filePath, "utf8");
        }
      } catch {
        // Can't read, skip content
      }
    }

    // Note: we record this AFTER the delete happens,
    // but we wait for the deletion to actually occur
    this.changes.push({
      messageId,
      toolCallId,
      toolName: "bash",
      timestamp: new Date().toISOString(),
      changes: [change],
    });
  }

  private rollbackSingleChange(change: FileChange, gitProjectRoot?: string): void {
    switch (change.type) {
      case "create":
        // File was created by the tool, so delete it.
        // Even in Git repos, newly-created files are not tracked — just unlink.
        if (fs.existsSync(change.filePath)) {
          fs.unlinkSync(change.filePath);
        }
        break;

      case "modify":
        // For Git-tracked files, prefer `git checkout` to restore committed content.
        if (gitProjectRoot && isFileGitTracked(gitProjectRoot, change.filePath)) {
          restoreFileFromGit(gitProjectRoot, change.filePath);
          return;
        }
        // Fallback: restore from stored previous content.
        if (change.previousContent !== undefined && change.previousContent !== null) {
          fs.writeFileSync(change.filePath, change.previousContent, "utf8");
        }
        break;

      case "delete":
        // For Git-tracked files, use git to restore.
        if (gitProjectRoot && isFileGitTracked(gitProjectRoot, change.filePath)) {
          restoreFileFromGit(gitProjectRoot, change.filePath);
          return;
        }
        // Fallback: restore from stored content.
        if (change.previousContent !== undefined && change.previousContent !== null) {
          const dir = path.dirname(change.filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(change.filePath, change.previousContent, "utf8");
        } else if (change.previousExists) {
          // We know the file existed but couldn't capture content.
          // The file may already be restored; if not, create an empty placeholder.
          if (!fs.existsSync(change.filePath)) {
            const dir = path.dirname(change.filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(change.filePath, "", "utf8");
          }
        }
        break;
    }
  }

  /**
   * Record a bash command that cannot be tracked or rolled back.
   */
  recordUntrackableCommand(messageId: string, toolCallId: string, command: string, reason: string): void {
    this.untrackableCommands.push({ messageId, toolCallId, command, reason });
  }

  /**
   * Get untrackable commands associated with messages after the given index.
   */
  getUntrackableCommandsAfter(messageIndex: number, messages: { id: string }[]): UntrackableCommand[] {
    const afterIds = new Set(messages.slice(messageIndex + 1).map((m) => m.id));
    if (afterIds.size === 0) return [];
    return this.untrackableCommands.filter((c) => afterIds.has(c.messageId));
  }

  /**
   * Perform rollback using the given changes. If the project is a Git repo,
   * Git-tracked files are restored via `git checkout HEAD -- <file>` instead
   * of writing stored previousContent.
   */
  rollback(changesToRollback: FileChangeRecord[], projectRoot?: string): string[] {
    const warnings: string[] = [];
    const isGit = typeof projectRoot === "string" && isGitRepo(projectRoot);

    // Collect all changes in reverse order
    const allChanges: { record: FileChangeRecord; change: FileChange }[] = [];
    for (const record of changesToRollback) {
      for (const change of record.changes) {
        allChanges.push({ record, change });
      }
    }

    // Reverse to undo in correct order
    allChanges.reverse();

    for (const { change } of allChanges) {
      try {
        this.rollbackSingleChange(change, isGit ? projectRoot : undefined);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        warnings.push(`Failed to rollback ${change.filePath}: ${msg}`);
      }
    }

    return warnings;
  }

  /**
   * Clear all tracked changes and untrackable commands (e.g., on session disposal).
   */
  clear(): void {
    this.changes.length = 0;
    this.untrackableCommands.length = 0;
  }

  // -------------------------------------------------------------------
  // Persistence helpers
  // -------------------------------------------------------------------

  /** Serialize current state for disk persistence. */
  toJSON(sessionId: string): FileChangeTrackerData {
    return {
      version: 1,
      sessionId,
      changes: this.changes,
      untrackableCommands: this.untrackableCommands,
    };
  }

  /** Restore state from previously serialized data, replacing current state. */
  loadFromJSON(data: FileChangeTrackerData): void {
    this.changes.length = 0;
    this.untrackableCommands.length = 0;
    if (Array.isArray(data.changes)) {
      for (const record of data.changes) {
        this.changes.push(record);
      }
    }
    if (Array.isArray(data.untrackableCommands)) {
      for (const cmd of data.untrackableCommands) {
        this.untrackableCommands.push(cmd);
      }
    }
  }
}

function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/[\\/]/g, path.sep);
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

/** Check whether a directory is inside a Git working tree. */
function isGitRepo(projectRoot: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: projectRoot,
      stdio: "ignore",
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

/** Check whether a specific file is tracked by Git. */
function isFileGitTracked(projectRoot: string, filePath: string): boolean {
  try {
    // Use git ls-files --error-unmatch: exits 0 when tracked, 1 otherwise.
    execSync(`git ls-files --error-unmatch -- "${filePath.replace(/"/g, '\\"')}"`, {
      cwd: projectRoot,
      stdio: "ignore",
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

/** Restore a file to its HEAD version via `git checkout`. */
function restoreFileFromGit(projectRoot: string, filePath: string): void {
  execSync(`git checkout HEAD -- "${filePath.replace(/"/g, '\\"')}"`, {
    cwd: projectRoot,
    stdio: "ignore",
    timeout: 10000,
  });
}
