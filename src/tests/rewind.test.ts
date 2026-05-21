import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import { SessionManager, type SessionMessage } from "../session";
import { FileChangeTracker } from "../common/file-change-tracker";
import type { FileChangeTrackerData } from "../common/file-change-tracker";

const originalHome = process.env.HOME;
const originalUserProfile = process.env.USERPROFILE;
const tempDirs: string[] = [];

function setHomeDir(dir: string): void {
  process.env.HOME = dir;
  if (process.platform === "win32") {
    process.env.USERPROFILE = dir;
  }
}

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  if (originalUserProfile === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = originalUserProfile;
  }

  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

// --- /rewind feature tests ---

test("getRewindableMessages returns visible user/assistant messages excluding the last", () => {
  const homeDir = createTempDir("deepcode-test-rewind-");
  const projectDir = createTempDir("deepcode-test-project-");
  setHomeDir(homeDir);

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const sessionId = "test-session-rewind-1";
  const now = new Date().toISOString();

  // Build messages manually via the internal append helper
  const append = (msg: SessionMessage) => (manager as any).appendSessionMessage(sessionId, msg);

  // System message (not visible to user)
  append({
    id: "sys-1",
    sessionId,
    role: "system",
    content: "system prompt",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: false,
    createTime: now,
    updateTime: now,
  });
  // User message 1
  append({
    id: "user-1",
    sessionId,
    role: "user",
    content: "Hello",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });
  // Assistant message 1
  append({
    id: "asst-1",
    sessionId,
    role: "assistant",
    content: "Hi there",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });
  // User message 2
  append({
    id: "user-2",
    sessionId,
    role: "user",
    content: "Do something",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });
  // Assistant message 2 (last message, should be excluded)
  append({
    id: "asst-2",
    sessionId,
    role: "assistant",
    content: "OK done",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Also add the session entry so the session "exists"
  const index = (manager as any).loadSessionsIndex();
  index.entries.push({
    id: sessionId,
    summary: "test",
    assistantReply: null,
    assistantThinking: null,
    assistantRefusal: null,
    toolCalls: null,
    status: "completed",
    failReason: null,
    usage: null,
    usagePerModel: null,
    activeTokens: 0,
    createTime: now,
    updateTime: now,
    processes: null,
  });
  (manager as any).saveSessionsIndex(index);

  const rewindable = manager.getRewindableMessages(sessionId);

  // Should include user-1, asst-1, user-2 (visible user/assistant messages)
  // Should exclude sys-1 (invisible system) and asst-2 (last message)
  assert.equal(rewindable.length, 3);
  assert.equal(rewindable[0]!.id, "user-1");
  assert.equal(rewindable[1]!.id, "asst-1");
  assert.equal(rewindable[2]!.id, "user-2");
});

test("rewindToMessage truncates messages and returns success", () => {
  const homeDir = createTempDir("deepcode-test-rewind2-");
  const projectDir = createTempDir("deepcode-test-project2-");
  setHomeDir(homeDir);

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const sessionId = "test-session-rewind-2";
  const now = new Date().toISOString();

  const append = (msg: SessionMessage) => (manager as any).appendSessionMessage(sessionId, msg);

  append({
    id: "user-1",
    sessionId,
    role: "user",
    content: "First message",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });
  append({
    id: "asst-1",
    sessionId,
    role: "assistant",
    content: "First reply",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });
  append({
    id: "user-2",
    sessionId,
    role: "user",
    content: "Second message",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });
  append({
    id: "asst-2",
    sessionId,
    role: "assistant",
    content: "Second reply",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  const index = (manager as any).loadSessionsIndex();
  index.entries.push({
    id: sessionId,
    summary: "test",
    assistantReply: null,
    assistantThinking: null,
    assistantRefusal: null,
    toolCalls: null,
    status: "completed",
    failReason: null,
    usage: null,
    usagePerModel: null,
    activeTokens: 0,
    createTime: now,
    updateTime: now,
    processes: null,
  });
  (manager as any).saveSessionsIndex(index);

  // Rewind to user-2: since user-2 is a user message, it gets "recalled"
  // into the input box — only user-1 and asst-1 are kept.
  const result = manager.rewindToMessage(sessionId, "user-2");

  assert.equal(result.success, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.prefillContent, "Second message");

  // Verify messages were truncated (target user message excluded)
  const messages = manager.listSessionMessages(sessionId);
  assert.equal(messages.length, 2);
  assert.equal(messages[0]!.id, "user-1");
  assert.equal(messages[1]!.id, "asst-1");
});

test("rewindToMessage returns failure for non-existent message", () => {
  const homeDir = createTempDir("deepcode-test-rewind3-");
  const projectDir = createTempDir("deepcode-test-project3-");
  setHomeDir(homeDir);

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const sessionId = "test-session-rewind-3";
  const now = new Date().toISOString();

  const append = (msg: SessionMessage) => (manager as any).appendSessionMessage(sessionId, msg);

  append({
    id: "user-1",
    sessionId,
    role: "user",
    content: "Hello",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  const index = (manager as any).loadSessionsIndex();
  index.entries.push({
    id: sessionId,
    summary: "test",
    assistantReply: null,
    assistantThinking: null,
    assistantRefusal: null,
    toolCalls: null,
    status: "completed",
    failReason: null,
    usage: null,
    usagePerModel: null,
    activeTokens: 0,
    createTime: now,
    updateTime: now,
    processes: null,
  });
  (manager as any).saveSessionsIndex(index);

  const result = manager.rewindToMessage(sessionId, "nonexistent-id");

  assert.equal(result.success, false);
  assert.deepEqual(result.warnings, []);
});

test("getRewindableMessages returns empty for session with only one message", () => {
  const homeDir = createTempDir("deepcode-test-rewind4-");
  const projectDir = createTempDir("deepcode-test-project4-");
  setHomeDir(homeDir);

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const sessionId = "test-session-rewind-4";
  const now = new Date().toISOString();

  const append = (msg: SessionMessage) => (manager as any).appendSessionMessage(sessionId, msg);

  append({
    id: "user-1",
    sessionId,
    role: "user",
    content: "Only message",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  const index = (manager as any).loadSessionsIndex();
  index.entries.push({
    id: sessionId,
    summary: "test",
    assistantReply: null,
    assistantThinking: null,
    assistantRefusal: null,
    toolCalls: null,
    status: "completed",
    failReason: null,
    usage: null,
    usagePerModel: null,
    activeTokens: 0,
    createTime: now,
    updateTime: now,
    processes: null,
  });
  (manager as any).saveSessionsIndex(index);

  const rewindable = manager.getRewindableMessages(sessionId);
  assert.equal(rewindable.length, 0);
});

// --- /rewind typical scenario integration test ---

test("rewind typical scenario: rewind to msg3 restores utils.js, removes utils.ts, reverts config.ts", () => {
  const homeDir = createTempDir("deepcode-test-rewind-typical-");
  const projectDir = createTempDir("deepcode-test-project-typical-");
  setHomeDir(homeDir);

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const tracker = (manager as any).fileChangeTracker as FileChangeTracker;
  const sessionId = "test-session-rewind-typical";
  const now = new Date().toISOString();
  const append = (msg: SessionMessage) => (manager as any).appendSessionMessage(sessionId, msg);

  const utilsJsPath = path.join(projectDir, "utils.js");
  const utilsTsPath = path.join(projectDir, "utils.ts");
  const configTsPath = path.join(projectDir, "config.ts");

  const utilsJsContent = "// utils.js - utility functions\nconsole.log('utils.js');\n";
  const utilsTsContent = "// utils.ts - TypeScript utilities\nconsole.log('utils.ts');\n";
  const configOriginalContent = "// config.ts - original\nconst config = { port: 3000 };\n";
  const configModifiedContent = "// config.ts - restructured\nconst config = { port: 8080, debug: true };\n";

  // ================================================================
  // Build the full conversation simulating 6 messages (with tool msgs)
  // ================================================================

  // Message 1 (User): "创建一个 utils.js 文件"
  append({
    id: "user-msg-1",
    sessionId,
    role: "user",
    content: "创建一个 utils.js 文件",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Message 2 (Assistant): calls Write Tool -> creates utils.js
  append({
    id: "asst-msg-2",
    sessionId,
    role: "assistant",
    content: "好的，我来创建 utils.js 文件",
    contentParams: null,
    messageParams: {
      tool_calls: [{ id: "call-write-1", type: "function", function: { name: "write", arguments: "{}" } }],
    },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Tool message for write (creates utils.js)
  append({
    id: "tool-msg-3",
    sessionId,
    role: "tool",
    content: "Created file.",
    contentParams: null,
    messageParams: { tool_call_id: "call-write-1" },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
    meta: { function: { name: "write" }, paramsMd: "", resultMd: "Created file." },
  });
  // Track: write tool creates utils.js
  tracker.recordChange("tool-msg-3", "call-write-1", "write", {
    type: "create",
    filePath: utilsJsPath,
    previousContent: null,
    previousExists: false,
  });
  // Actually create the file on disk (post-write state)
  fs.writeFileSync(utilsJsPath, utilsJsContent, "utf8");

  // Message 3 (User): "删除 utils.js，改用 utils.ts" — REWIND TARGET
  append({
    id: "user-msg-4",
    sessionId,
    role: "user",
    content: "删除 utils.js，改用 utils.ts",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Message 4 (Assistant): calls Bash (rm utils.js) + Write (creates utils.ts)
  append({
    id: "asst-msg-5",
    sessionId,
    role: "assistant",
    content: "好的，我来删除 utils.js 并创建 utils.ts",
    contentParams: null,
    messageParams: {
      tool_calls: [
        { id: "call-bash-1", type: "function", function: { name: "bash", arguments: "{}" } },
        { id: "call-write-2", type: "function", function: { name: "write", arguments: "{}" } },
      ],
    },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Tool message for bash (deletes utils.js)
  append({
    id: "tool-msg-6",
    sessionId,
    role: "tool",
    content: "Deleted utils.js successfully.",
    contentParams: null,
    messageParams: { tool_call_id: "call-bash-1" },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
    meta: { function: { name: "bash" }, paramsMd: "", resultMd: "Deleted utils.js" },
  });
  // Track: bash cmd deletes utils.js (capture content before delete)
  tracker.recordChange("tool-msg-6", "call-bash-1", "bash", {
    type: "delete",
    filePath: utilsJsPath,
    previousContent: utilsJsContent,
    previousExists: true,
  });
  // Actually delete the file from disk (post-bash state)
  fs.unlinkSync(utilsJsPath);

  // Tool message for write (creates utils.ts)
  append({
    id: "tool-msg-7",
    sessionId,
    role: "tool",
    content: "Created file.",
    contentParams: null,
    messageParams: { tool_call_id: "call-write-2" },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
    meta: { function: { name: "write" }, paramsMd: "", resultMd: "Created file." },
  });
  // Track: write tool creates utils.ts
  tracker.recordChange("tool-msg-7", "call-write-2", "write", {
    type: "create",
    filePath: utilsTsPath,
    previousContent: null,
    previousExists: false,
  });
  // Actually create utils.ts on disk
  fs.writeFileSync(utilsTsPath, utilsTsContent, "utf8");

  // Message 5 (User): "重构代码结构"
  append({
    id: "user-msg-8",
    sessionId,
    role: "user",
    content: "重构代码结构",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Message 6 (Assistant): calls Edit Tool -> modifies config.ts
  append({
    id: "asst-msg-9",
    sessionId,
    role: "assistant",
    content: "好的，我来重构代码结构",
    contentParams: null,
    messageParams: {
      tool_calls: [{ id: "call-edit-1", type: "function", function: { name: "edit", arguments: "{}" } }],
    },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Create config.ts with original content first (pre-edit state)
  fs.writeFileSync(configTsPath, configOriginalContent, "utf8");

  // Tool message for edit (modifies config.ts)
  append({
    id: "tool-msg-10",
    sessionId,
    role: "tool",
    content: "Replaced 1 occurrence(s) in config.ts.",
    contentParams: null,
    messageParams: { tool_call_id: "call-edit-1" },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
    meta: { function: { name: "edit" }, paramsMd: "", resultMd: "Replaced 1 occurrence(s)" },
  });
  // Track: edit tool modifies config.ts (capture original before modifying)
  tracker.recordChange("tool-msg-10", "call-edit-1", "edit", {
    type: "modify",
    filePath: configTsPath,
    previousContent: configOriginalContent,
    previousExists: true,
  });
  // Write the modified content (post-edit state)
  fs.writeFileSync(configTsPath, configModifiedContent, "utf8");

  // Last assistant reply (ensures getRewindableMessages excludes the last message)
  append({
    id: "asst-msg-11",
    sessionId,
    role: "assistant",
    content: "重构完成！",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Register the session entry
  const index = (manager as any).loadSessionsIndex();
  index.entries.push({
    id: sessionId,
    summary: "rewind typical scenario",
    assistantReply: null,
    assistantThinking: null,
    assistantRefusal: null,
    toolCalls: null,
    status: "completed",
    failReason: null,
    usage: null,
    usagePerModel: null,
    activeTokens: 0,
    createTime: now,
    updateTime: now,
    processes: null,
  });
  (manager as any).saveSessionsIndex(index);

  // ================================================================
  // Execute rewind to Message 3 (user-msg-4)
  // Since user-msg-4 is a user message, it gets "recalled" into the input box
  // and is excluded from the message list.
  // ================================================================
  const result = manager.rewindToMessage(sessionId, "user-msg-4");

  // ================================================================
  // Verify
  // ================================================================

  // 1. rewindToMessage should succeed and return prefillContent
  assert.equal(result.success, true);
  assert.equal(result.prefillContent, "删除 utils.js，改用 utils.ts");

  // 2. Messages should be truncated to msg1–msg3 (target user message excluded)
  const messages = manager.listSessionMessages(sessionId);
  assert.equal(messages.length, 3);
  assert.equal(messages[0]!.id, "user-msg-1");
  assert.equal(messages[1]!.id, "asst-msg-2");
  assert.equal(messages[2]!.id, "tool-msg-3");

  // 3. ✅ utils.js should exist (created by msg2, restored by rolling back msg4's bash rm)
  assert.equal(fs.existsSync(utilsJsPath), true, "utils.js should exist after rewind");
  assert.equal(fs.readFileSync(utilsJsPath, "utf8"), utilsJsContent, "utils.js content should be restored");

  // 4. ✅ utils.ts should NOT exist (created by msg4's write, rolled back)
  assert.equal(fs.existsSync(utilsTsPath), false, "utils.ts should not exist after rewind");

  // 5. ✅ config.ts should be restored to its original content (modified by msg6's edit, rolled back)
  assert.equal(
    fs.readFileSync(configTsPath, "utf8"),
    configOriginalContent,
    "config.ts should be restored to original"
  );
});

// --- /rewind bash mv rename scenario ---

test("rewind reverts bash mv rename: utils.ts restored to utils.js after rewind", () => {
  const homeDir = createTempDir("deepcode-test-rewind-mv-");
  const projectDir = createTempDir("deepcode-test-project-mv-");
  setHomeDir(homeDir);

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const tracker = (manager as any).fileChangeTracker as FileChangeTracker;
  const sessionId = "test-session-rewind-mv";
  const now = new Date().toISOString();
  const append = (msg: SessionMessage) => (manager as any).appendSessionMessage(sessionId, msg);

  const utilsJsPath = path.join(projectDir, "utils.js");
  const utilsTsPath = path.join(projectDir, "utils.ts");
  const utilsJsContent = "// utils.js - original utility functions\nexport function add(a, b) { return a + b; }\n";

  // Step 1: Create utils.js on disk (simulating it was created earlier)
  fs.writeFileSync(utilsJsPath, utilsJsContent, "utf8");

  // ================================================================
  // Build conversation: user asks to rename, assistant runs mv
  // ================================================================

  // Message 1 (User): "把 utils.js 重命名为 utils.ts"
  append({
    id: "user-msg-1",
    sessionId,
    role: "user",
    content: "把 utils.js 重命名为 utils.ts",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Message 2 (Assistant): calls Bash mv
  append({
    id: "asst-msg-2",
    sessionId,
    role: "assistant",
    content: "好的，我来重命名",
    contentParams: null,
    messageParams: {
      tool_calls: [{ id: "call-bash-mv", type: "function", function: { name: "bash", arguments: "{}" } }],
    },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Simulate trackBashFileChanges called BEFORE executeShellCommand:
  // mv utils.js utils.ts → source exists with content, dest does not exist
  // This is what the fix ensures: capturing state before the bash runs.
  // Source file (will be deleted by mv)
  tracker.recordChange("tool-msg-3", "call-bash-mv", "bash", {
    type: "delete",
    filePath: utilsJsPath,
    previousContent: utilsJsContent,
    previousExists: true,
  });
  // Dest file (will be created by mv, doesn't exist yet)
  tracker.recordChange("tool-msg-3", "call-bash-mv", "bash", {
    type: "create",
    filePath: utilsTsPath,
    previousContent: null,
    previousExists: false,
  });

  // Tool message for bash mv
  append({
    id: "tool-msg-3",
    sessionId,
    role: "tool",
    content: "Renamed utils.js to utils.ts successfully.",
    contentParams: null,
    messageParams: { tool_call_id: "call-bash-mv" },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
    meta: { function: { name: "bash" }, paramsMd: "", resultMd: "Renamed" },
  });

  // Actually perform the mv on disk (post-bash state)
  fs.renameSync(utilsJsPath, utilsTsPath);

  // Last assistant reply
  append({
    id: "asst-msg-4",
    sessionId,
    role: "assistant",
    content: "重命名完成！",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Register the session entry
  const index = (manager as any).loadSessionsIndex();
  index.entries.push({
    id: sessionId,
    summary: "rewind mv scenario",
    assistantReply: null,
    assistantThinking: null,
    assistantRefusal: null,
    toolCalls: null,
    status: "completed",
    failReason: null,
    usage: null,
    usagePerModel: null,
    activeTokens: 0,
    createTime: now,
    updateTime: now,
    processes: null,
  });
  (manager as any).saveSessionsIndex(index);

  // ================================================================
  // Execute rewind to Message 1 (user-msg-1) — back to before the mv
  // Since user-msg-1 is a user message, it gets "recalled" into the input box.
  // ================================================================
  const result = manager.rewindToMessage(sessionId, "user-msg-1");

  // ================================================================
  // Verify
  // ================================================================

  assert.equal(result.success, true);
  assert.equal(result.prefillContent, "把 utils.js 重命名为 utils.ts");

  // 1. Messages should be empty (target user message excluded)
  const messages = manager.listSessionMessages(sessionId);
  assert.equal(messages.length, 0);

  // 2. ✅ utils.js should EXIST back (was deleted by mv, rolled back)
  assert.equal(fs.existsSync(utilsJsPath), true, "utils.js should be restored after rewind");
  assert.equal(fs.readFileSync(utilsJsPath, "utf8"), utilsJsContent, "utils.js content should match original");

  // 3. ✅ utils.ts should NOT exist (was created by mv, rolled back)
  assert.equal(fs.existsSync(utilsTsPath), false, "utils.ts should be removed after rewind");
});

// --- Git-based rollback test ---

test("FileChangeTracker.rollback uses git checkout for tracked files in a Git repo", () => {
  const tmpDir = createTempDir("deepcode-test-git-rollback-");

  // Initialize a git repo
  execSync("git init", { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.email "test@test.com"', { cwd: tmpDir, stdio: "ignore" });
  execSync('git config user.name "Test"', { cwd: tmpDir, stdio: "ignore" });

  // Create and commit a file
  const filePath = path.join(tmpDir, "tracked-file.ts");
  const originalContent = "// Original tracked content\nconsole.log('original');\n";
  fs.writeFileSync(filePath, originalContent, "utf8");
  execSync("git add tracked-file.ts", { cwd: tmpDir, stdio: "ignore" });
  execSync('git commit -m "initial commit"', { cwd: tmpDir, stdio: "ignore" });

  // Modify the file (simulate tool modification)
  fs.writeFileSync(filePath, "// Modified content\nconsole.log('modified');\n", "utf8");

  const tracker = new FileChangeTracker();

  // Record a modify change for the tracked file
  tracker.recordChange("msg-1", "call-1", "write", {
    type: "modify",
    filePath,
    previousContent: originalContent,
    previousExists: true,
  });

  // Rollback with projectRoot (Git repo)
  const warnings = tracker.rollback(tracker.getChangesAfter(-1, [{ id: "msg-1" }]), tmpDir);

  // Verify: file should be restored to committed version (not stored previousContent)
  assert.equal(warnings.length, 0, "should have no rollback errors");
  const restored = fs.readFileSync(filePath, "utf8");
  assert.equal(restored, originalContent, "file should be restored via git checkout");
});

// --- Untrackable bash command warning test ---

test("rewindToMessage includes warnings for untrackable bash commands", () => {
  const homeDir = createTempDir("deepcode-test-untrackable-");
  const projectDir = createTempDir("deepcode-test-project-untrackable-");
  setHomeDir(homeDir);

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const tracker = (manager as any).fileChangeTracker as FileChangeTracker;
  const sessionId = "test-session-untrackable";
  const now = new Date().toISOString();
  const append = (msg: SessionMessage) => (manager as any).appendSessionMessage(sessionId, msg);

  // Message 1 (User)
  append({
    id: "user-msg-1",
    sessionId,
    role: "user",
    content: "Install a package",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Message 2 (Assistant) with bash tool call
  append({
    id: "asst-msg-2",
    sessionId,
    role: "assistant",
    content: "Running apt-get install",
    contentParams: null,
    messageParams: {
      tool_calls: [{ id: "call-bash-apt", type: "function", function: { name: "bash", arguments: "{}" } }],
    },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Tool message for bash (apt-get install)
  append({
    id: "tool-msg-3",
    sessionId,
    role: "tool",
    content: "Package installed.",
    contentParams: null,
    messageParams: { tool_call_id: "call-bash-apt" },
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
    meta: { function: { name: "bash" }, paramsMd: "", resultMd: "Installed" },
  });

  // Record an untrackable command for the bash tool message
  tracker.recordUntrackableCommand("tool-msg-3", "call-bash-apt", "apt-get install nginx", "affects system packages");

  // Message 3 (Assistant reply) — ensures getRewindableMessages excludes the last
  append({
    id: "asst-msg-4",
    sessionId,
    role: "assistant",
    content: "Package installed successfully!",
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  });

  // Register session entry
  const index = (manager as any).loadSessionsIndex();
  index.entries.push({
    id: sessionId,
    summary: "untrackable test",
    assistantReply: null,
    assistantThinking: null,
    assistantRefusal: null,
    toolCalls: null,
    status: "completed",
    failReason: null,
    usage: null,
    usagePerModel: null,
    activeTokens: 0,
    createTime: now,
    updateTime: now,
    processes: null,
  });
  (manager as any).saveSessionsIndex(index);

  // Rewind to message 1 (user-msg-1) — removes tool-msg-3 and asst-msg-4
  const result = manager.rewindToMessage(sessionId, "user-msg-1");

  assert.equal(result.success, true);
  assert.ok(result.warnings.length > 0, "should include untrackable command warnings");
  const hasUntrackableWarning = result.warnings.some(
    (w: string) => w.includes("Untrackable bash operation") && w.includes("apt-get install nginx")
  );
  assert.equal(hasUntrackableWarning, true, "should warn about apt-get install");
});

// --- Large file content exclusion test ---

test("captureBeforeChange excludes content for files larger than 1MB", () => {
  const tmpDir = createTempDir("deepcode-test-largefile-");
  const largeFilePath = path.join(tmpDir, "large-file.bin");

  // Create a file > 1MB
  const oneMBPlus = Buffer.alloc(1_000_001, 0x41); // 'A' repeated
  fs.writeFileSync(largeFilePath, oneMBPlus);

  const tracker = new FileChangeTracker();

  const change = tracker.captureBeforeChange("msg-large", "call-large", "write", largeFilePath, "write");

  assert.equal(change.type, "modify");
  assert.equal(change.previousExists, true);
  assert.ok(
    change.previousContent === undefined || change.previousContent === null,
    "should not store content for files > 1MB"
  );
});

// --- File deduplication in same message test ---

test("recordChange deduplicates multiple changes to the same file within a single message", () => {
  const tmpDir = createTempDir("deepcode-test-dedup-");
  const filePath = path.join(tmpDir, "dedup-test.ts");

  const originalContent = "// Version 1\n";
  fs.writeFileSync(filePath, originalContent, "utf8");

  const tracker = new FileChangeTracker();

  // First change: modify with original content captured
  tracker.recordChange("msg-dedup", "call-1", "edit", {
    type: "modify",
    filePath,
    previousContent: originalContent,
    previousExists: true,
  });

  // Second change: same file, same message — should merge, keeping first previousContent
  tracker.recordChange("msg-dedup", "call-2", "edit", {
    type: "modify",
    filePath,
    previousContent: "// Version 2\n",
    previousExists: true,
  });

  // Get changes for this message
  const changes = tracker.getChangesAfter(-1, [{ id: "msg-dedup" }]);
  assert.equal(changes.length, 1, "should have only one record for the same file+message");
  const singleRecord = changes[0]!;
  assert.equal(singleRecord.changes.length, 1);
  assert.equal(singleRecord.changes[0]!.previousContent, originalContent, "should keep the first previousContent");
});

// --- Persistence round-trip tests ---

test("FileChangeTracker.toJSON() and loadFromJSON() round-trip preserves all data", () => {
  const tracker = new FileChangeTracker();

  // Record a file change
  tracker.recordChange("msg-1", "call-1", "write", {
    type: "create",
    filePath: "/tmp/test.js",
    previousContent: null,
    previousExists: false,
  });

  // Record another change
  tracker.recordChange("msg-2", "call-2", "edit", {
    type: "modify",
    filePath: "/tmp/test.js",
    previousContent: "old content",
    previousExists: true,
  });

  // Record an untrackable command
  tracker.recordUntrackableCommand("msg-3", "call-3", "apt-get install nginx", "system package");

  // Serialize
  const data = tracker.toJSON("session-123");
  assert.equal(data.version, 1);
  assert.equal(data.sessionId, "session-123");
  assert.equal(data.changes.length, 2);
  assert.equal(data.untrackableCommands.length, 1);

  // Create a new tracker and load
  const tracker2 = new FileChangeTracker();
  tracker2.loadFromJSON(data);

  // Verify changes are restored
  const changesAfter = tracker2.getChangesAfter(-1, [{ id: "msg-1" }, { id: "msg-2" }]);
  assert.equal(changesAfter.length, 2);
  assert.equal(changesAfter[0]!.changes[0]!.filePath, "/tmp/test.js");
  assert.equal(changesAfter[0]!.changes[0]!.type, "create");
  assert.equal(changesAfter[1]!.changes[0]!.type, "modify");
  assert.equal(changesAfter[1]!.changes[0]!.previousContent, "old content");

  // Verify untrackable commands are restored
  const untracked = tracker2.getUntrackableCommandsAfter(-1, [{ id: "msg-1" }, { id: "msg-2" }, { id: "msg-3" }]);
  assert.equal(untracked.length, 1);
  assert.equal(untracked[0]!.command, "apt-get install nginx");
});

test("SessionManager persists and loads file changes from disk", () => {
  const homeDir = createTempDir("deepcode-test-persist-home-");
  const projectDir = createTempDir("deepcode-test-persist-project-");
  setHomeDir(homeDir);

  const filePath = path.join(projectDir, "test-persist.ts");
  const fileContent = "// original content\n";
  fs.writeFileSync(filePath, fileContent, "utf8");

  const sessionId = "test-session-persist";
  const now = new Date().toISOString();

  // --- Phase 1: Create SessionManager, record changes, save to disk ---
  const manager1 = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const tracker1 = (manager1 as any).fileChangeTracker as FileChangeTracker;

  // Simulate a tool change
  tracker1.recordChange("tool-msg", "call-write", "write", {
    type: "modify",
    filePath,
    previousContent: fileContent,
    previousExists: true,
  });

  // Save to disk
  (manager1 as any).saveFileChanges(sessionId);

  // --- Phase 2: Create a NEW SessionManager instance (simulating restart) and load from disk ---
  const manager2 = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  const tracker2 = (manager2 as any).fileChangeTracker as FileChangeTracker;

  // Verify tracker is empty before loading
  assert.equal(tracker2.getChangesAfter(-1, [{ id: "tool-msg" }]).length, 0, "tracker should be empty before load");

  // Load from disk
  (manager2 as any).loadFileChanges(sessionId);

  // Verify the change is restored
  const loadedChanges = tracker2.getChangesAfter(-1, [{ id: "tool-msg" }]);
  assert.equal(loadedChanges.length, 1, "should have one change after load");
  assert.equal(loadedChanges[0]!.changes[0]!.filePath, filePath);
  assert.equal(loadedChanges[0]!.changes[0]!.type, "modify");
  assert.equal(loadedChanges[0]!.changes[0]!.previousContent, fileContent);
});

test("removeFileChanges deletes persisted file from disk", () => {
  const homeDir = createTempDir("deepcode-test-remove-home-");
  const projectDir = createTempDir("deepcode-test-remove-project-");
  setHomeDir(homeDir);

  const sessionId = "test-session-remove";

  const manager = new SessionManager({
    projectRoot: projectDir,
    createOpenAIClient: () => ({
      client: null,
      model: "test-model",
      thinkingEnabled: false,
    }),
    getResolvedSettings: () => ({ model: "test-model" }),
    renderMarkdown: (text) => text,
    onAssistantMessage: () => {},
  });

  // Save some changes
  const tracker = (manager as any).fileChangeTracker as FileChangeTracker;
  tracker.recordChange("msg-1", "call-1", "write", {
    type: "create",
    filePath: path.join(projectDir, "foo.ts"),
    previousContent: null,
    previousExists: false,
  });
  (manager as any).saveFileChanges(sessionId);

  // Verify file exists
  const fileChangesPath = (manager as any).getFileChangesPath(sessionId) as string;
  assert.equal(fs.existsSync(fileChangesPath), true, "file changes JSON should exist after save");

  // Remove
  (manager as any).removeFileChanges([sessionId]);

  // Verify file is gone
  assert.equal(fs.existsSync(fileChangesPath), false, "file changes JSON should be deleted after remove");
});

// --- Diff-based rollback tests ---

test("finalizeWithDiff computes and stores reverseDiff", () => {
  const projectDir = createTempDir("deepcode-test-diff-1-");

  const tracker = new FileChangeTracker();
  const oldContent = "line1\nline2 old\nline3\n";
  const newContent = "line1\nline2 new\nline3\n";

  // Write the old content to disk (simulate file before modification)
  const filePath = path.join(projectDir, "test.txt");
  fs.writeFileSync(filePath, oldContent, "utf8");

  // Record a modify change with old content
  tracker.recordChange("msg-1", "call-1", "edit", {
    type: "modify",
    filePath,
    previousContent: oldContent,
    previousExists: true,
  });

  // Simulate: tool writes new content, then finalize
  fs.writeFileSync(filePath, newContent, "utf8");
  tracker.finalizeWithDiff("msg-1", filePath, newContent);

  // Verify reverseDiff was generated
  const data = tracker.toJSON("session-1");
  const change = data.changes[0]?.changes[0];
  assert.ok(change, "change should exist");
  assert.ok(change!.reverseDiff, "reverseDiff should be computed");
  assert.ok(change!.reverseDiff!.includes("line2 old"), "reverseDiff should contain old content");
  assert.ok(change!.reverseDiff!.includes("line2 new"), "reverseDiff should contain new content");
});

test("rollback applies reverseDiff before falling back to previousContent", () => {
  const projectDir = createTempDir("deepcode-test-diff-2-");

  const tracker = new FileChangeTracker();
  const oldContent = "line1\nline2 before\nline3\n";
  const newContent = "line1\nline2 after edit\nline3\n";

  const filePath = path.join(projectDir, "test-edit.txt");
  fs.writeFileSync(filePath, oldContent, "utf8");

  // Record change and finalize
  tracker.recordChange("msg-1", "call-1", "edit", {
    type: "modify",
    filePath,
    previousContent: oldContent,
    previousExists: true,
  });
  fs.writeFileSync(filePath, newContent, "utf8");
  tracker.finalizeWithDiff("msg-1", filePath, newContent);

  // Now simulate rollback (non-Git project)
  // Rollback should try reverseDiff first and succeed
  const changesToRollback = tracker.getChangesAfter(-1, [{ id: "msg-1" }]);
  assert.equal(changesToRollback.length, 1, "should have one change record to roll back");

  const warnings = tracker.rollback(changesToRollback, projectDir);
  assert.equal(warnings.length, 0, "rollback should succeed without warnings");

  // Verify file was restored to old content via reverseDiff
  const restored = fs.readFileSync(filePath, "utf8");
  assert.equal(restored, oldContent, "file should be restored to old content via reverseDiff");
});

test("rollback falls back to previousContent when file no longer matches reverseDiff", () => {
  const projectDir = createTempDir("deepcode-test-diff-3-");

  const tracker = new FileChangeTracker();
  const oldContent = "lineA\nlineB original\nlineC\n";
  const newContent = "lineA\nlineB changed\nlineC\n";
  const tamperedContent = "lineA\nlineB someone changed it\nlineC\n";

  const filePath = path.join(projectDir, "test-fallback.txt");
  fs.writeFileSync(filePath, oldContent, "utf8");

  // Record change and finalize
  tracker.recordChange("msg-1", "call-1", "edit", {
    type: "modify",
    filePath,
    previousContent: oldContent,
    previousExists: true,
  });
  fs.writeFileSync(filePath, newContent, "utf8");
  tracker.finalizeWithDiff("msg-1", filePath, newContent);

  // Tamper with the file so it no longer matches the expected diff pattern
  fs.writeFileSync(filePath, tamperedContent, "utf8");

  // Rollback should fail to apply reverseDiff (file doesn't match),
  // but fall back to previousContent successfully.
  const changesToRollback = tracker.getChangesAfter(-1, [{ id: "msg-1" }]);
  const warnings = tracker.rollback(changesToRollback, projectDir);
  assert.equal(warnings.length, 0, "rollback should succeed via previousContent fallback");

  // Verify file was restored to old content (via previousContent fallback)
  const restored = fs.readFileSync(filePath, "utf8");
  assert.equal(restored, oldContent, "file should be restored to old content via previousContent fallback");
});
