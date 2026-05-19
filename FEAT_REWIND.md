# Feature: /rewind 命令 - 跳转到指定消息并重启对话

## 📋 功能概述

实现 `/rewind` 命令，允许用户跳转到历史指定消息位置，并从该位置重新开始对话。该功能将删除目标消息之后的所有对话记录，为用户提供对话分支管理能力。

## 🎯 用户需求

作为用户，我希望能够：
- 回退到对话历史中的任意位置
- 从该位置开始新的对话分支
- 避免重新输入前面的上下文信息

## ✅ 可行性分析

**结论：完全可实现** ✅

当前代码库已具备所有必要的基础设施：
- 消息管理系统完善（`listSessionMessages`、`saveSessionMessages`）
- Session 状态机制健全（`updateSessionEntry`）
- Slash command 命令系统成熟
- JSONL 持久化方案简单高效

## 🏗️ 技术方案

### 核心架构

```
用户输入 /rewind
    ↓
PromptInput 识别命令
    ↓
显示 RewindMessageList 消息选择器
    ↓
用户选择目标消息
    ↓
SessionManager.rewindToMessage()
    ↓
截断消息列表并保存
    ↓
更新 UI 状态
```

### 涉及文件清单

| 文件路径 | 修改类型 | 说明 |
|---------|---------|------|
| `src/ui/slashCommands.ts` | 修改 | 添加 rewind 命令定义 |
| `src/ui/PromptInput.tsx` | 修改 | 添加命令处理逻辑 |
| `src/ui/App.tsx` | 修改 | 添加 rewind 命令 handler |
| `src/session.ts` | 修改 | 添加 `rewindToMessage()` 核心方法 |
| `src/ui/RewindMessageList.tsx` | 新增 | 消息选择 UI 组件 |
| `src/tests/rewind.test.ts` | 新增 | 单元测试 |
| `src/tools/executor.ts` | 🔥 修改 | 添加 `onFileChange` 回调 |
| `src/tools/write-handler.ts` | 🔥 修改 | 实现文件变更追踪 |
| `src/tools/edit-handler.ts` | 🔥 修改 | 实现文件变更追踪 |
| `src/tools/bash-handler.ts` | 🔥 修改 | 追踪文件操作（rm, mv 等） |
| `src/common/file-change-tracker.ts` | 🔥 新增 | 文件变更追踪模块 |
| `src/tests/fileChangeTracking.test.ts` | 🔥 新增 | 文件变更追踪测试 |
| `src/tests/fileRollback.test.ts` | 🔥 新增 | 文件回滚逻辑测试 |

## 📝 详细实现方案

### 1. SessionManager 核心方法

#### `rewindToMessage(sessionId, targetMessageId)`

**功能：** 回退到指定消息，删除该消息之后的所有记录

**实现要点：**
```typescript
rewindToMessage(sessionId: string, targetMessageId: string): boolean {
  const messages = this.listSessionMessages(sessionId);
  const targetIndex = messages.findIndex(m => m.id === targetMessageId);
  
  if (targetIndex === -1) {
    return false;
  }
  
  // 保留目标消息及之前的所有消息
  const keptMessages = messages.slice(0, targetIndex + 1);
  
  // 保存截断后的消息
  this.saveSessionMessages(sessionId, keptMessages);
  
  // 更新 session 状态
  this.updateSessionEntry(sessionId, (entry) => ({
    ...entry,
    status: "completed",
    failReason: null,
    toolCalls: null,
    assistantReply: null,
    assistantThinking: null,
    updateTime: new Date().toISOString(),
  }));
  
  return true;
}
```

#### `getRewindableMessages(sessionId)`

**功能：** 获取可用于 rewind 的消息列表（排除系统消息和已 compact 的消息）

```typescript
getRewindableMessages(sessionId: string): SessionMessage[] {
  return this.listSessionMessages(sessionId)
    .filter(m => m.visible && (m.role === "user" || m.role === "assistant"));
}
```

### 2. Slash Command 定义

在 `src/ui/slashCommands.ts` 中添加：

```typescript
// 类型定义
export type SlashCommandKind =
  | "skill"
  | "skills"
  | "model"
  | "new"
  | "init"
  | "resume"
  | "continue"
  | "mcp"
  | "raw"
  | "rewind"  // 新增
  | "exit";

// 命令配置
{
  kind: "rewind",
  name: "rewind",
  label: "/rewind",
  description: "Jump back to a specific message and restart the conversation",
}
```

### 3. PromptInput 处理逻辑

在 `PromptSubmission` 类型中添加：

```typescript
export type PromptSubmission = {
  text: string;
  imageUrls: string[];
  selectedSkills?: SkillInfo[];
  command?: "new" | "resume" | "continue" | "mcp" | "exit" | "rewind"; // 添加 rewind
  rewindTargetId?: string; // 新增：目标消息 ID
};
```

在 `handleSlashSelection` 中添加：

```typescript
if (item.kind === "rewind") {
  // 显示消息选择器或提交 rewind 命令
  setShowRewindList(true);
  clearSlashToken();
  return;
}
```

### 4. App 组件命令处理

在 `handlePrompt` 中添加：

```typescript
if (submission.command === "rewind") {
  const activeSessionId = sessionManager.getActiveSessionId();
  
  if (!activeSessionId) {
    setErrorLine("No active session to rewind");
    return;
  }
  
  if (!submission.rewindTargetId) {
    // 显示消息选择器
    setShowRewindList(true);
    return;
  }
  
  const success = sessionManager.rewindToMessage(
    activeSessionId, 
    submission.rewindTargetId
  );
  
  if (success) {
    // 更新 UI 状态
    const messages = sessionManager.listSessionMessages(activeSessionId)
      .filter(m => m.visible);
    setMessages(messages);
    setBusy(false);
    setErrorLine(null);
    setStreamProgress(null);
    setRunningProcesses(null);
    setActiveStatus("completed");
    setShowRewindList(false);
  } else {
    setErrorLine("Failed to rewind: message not found");
  }
  
  return;
}
```

### 5. RewindMessageList UI 组件

**新建文件：** `src/ui/RewindMessageList.tsx`

**组件特性：**
- 显示消息列表（角色、时间、内容预览）
- 支持上下键导航
- 支持 Enter 确认选择
- 支持 ESC 取消
- 最大可见项数：8 项（参考 SlashCommandMenu）
- 滚动机制

**UI 示例：**
```
Select message to rewind to:
  ○ User (14:32) - "How to implement authentication..."
  ○ Assistant (14:32) - "I'll help you implement auth..."
  > User (14:35) - "Can we use JWT instead?"
  ○ Assistant (14:35) - "Yes, JWT is a great choice..."
  
Press Enter to select, ESC to cancel
```

## 🎨 UI/UX 设计

### 交互流程

1. **触发命令**：用户输入 `/rewind` 或从命令菜单选择
2. **显示列表**：弹出 RewindMessageList 组件
3. **浏览消息**：使用 ↑↓ 键浏览历史消息
4. **确认选择**：按 Enter 选择目标消息
5. **执行回退**：系统执行 rewind 操作
6. **状态更新**：UI 刷新，显示回退后的消息列表

### 取消操作

- 按 ESC 取消 rewind
- 返回正常聊天界面

## ⚠️ 边界情况处理

### 必须处理的场景

| 场景           | 处理方式                              |
|--------------|-----------------------------------|
| 目标消息不存在      | 返回错误提示 "Message not found"        |
| 当前没有活跃会话     | 返回错误提示 "No active session"        |
| 目标是最后一条消息    | 提示 "Already at latest message"    |
| 目标是系统消息      | 过滤系统消息，不显示在选择列表中                  |
| 后台任务正在运行     | 先调用 `interruptActiveSession()`    |
| Raw 模式下操作    | 切换回 Normal 模式再执行                  |
| Compact 消息处理 | 保留 `compacted: true` 的 summary 消息 |

### 🔥 文件系统状态回滚（关键）

#### 问题描述

**核心问题：** `/rewind` 不仅是消息历史回退，还涉及到文件系统状态的还原。

当 AI 在对话中执行了以下操作：
- **Write Tool**: 创建/覆盖文件
- **Edit Tool**: 修改文件内容
- **Bash Tool**: 删除文件、修改文件、执行 git 操作等

如果用户回退到这些操作之前的消息，**文件系统必须也回到对应的状态**。

#### 典型场景

```
消息 1 (User): "创建一个 utils.js 文件"
消息 2 (Assistant): 调用 Write Tool 创建 utils.js
消息 3 (User): "删除 utils.js，改用 utils.ts"
消息 4 (Assistant): 调用 Bash Tool 删除 utils.js，调用 Write Tool 创建 utils.ts
消息 5 (User): "重构代码结构"
消息 6 (Assistant): 调用 Edit Tool 修改多个文件

用户执行: /rewind 到消息 3
预期结果:
  ✅ utils.js 应该存在（消息 2 创建的）
  ✅ utils.ts 应该不存在（消息 4 才创建）
  ✅ 其他被修改的文件应该回到消息 3 时的状态
```

#### 实现方案

**方案 A：文件系统快照（推荐用于 MVP）**

在每次工具执行前后记录文件状态变更：

```typescript
// 新增：文件变更追踪
type FileChangeRecord = {
  messageId: string;      // 关联的消息 ID
  toolCallId: string;     // 工具调用 ID
  toolName: string;       // write/edit/bash
  timestamp: string;      // 变更时间
  changes: FileChange[];  // 具体变更
};

type FileChange = {
  type: 'create' | 'modify' | 'delete';
  filePath: string;
  previousContent?: string;  // 变更前的内容（用于回滚）
  previousExists: boolean;   // 变更前是否存在
  previousHash?: string;     // 文件 hash（用于检测外部修改）
};
```

**实现步骤：**

1. **在 ToolExecutor 中添加钩子**

```typescript
// src/tools/executor.ts
export type ToolExecutionHooks = {
  onProcessStart?: (processId: string | number, command: string) => void;
  onProcessExit?: (processId: string | number) => void;
  onProcessStdout?: (processId: string | number, chunk: string) => void;
  shouldStop?: () => boolean;
  onFileChange?: (change: FileChange) => void; // 新增：文件变更回调
};
```

2. **在各个 Tool Handler 中追踪变更**

```typescript
// src/tools/write-handler.ts
// 在写入文件前记录
const previousContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
const previousExists = fs.existsSync(filePath);

// 执行写入...

// 通知变更
context.onFileChange?.({
  type: previousExists ? 'modify' : 'create',
  filePath,
  previousContent,
  previousExists,
});
```

3. **在 SessionManager 中存储变更历史**

```typescript
// src/session.ts
private fileChangeHistory: FileChangeRecord[] = [];

// 在 appendToolMessage 时记录
private recordFileChanges(
  messageId: string, 
  toolCallId: string, 
  toolName: string,
  changes: FileChange[]
): void {
  this.fileChangeHistory.push({
    messageId,
    toolCallId,
    toolName,
    timestamp: new Date().toISOString(),
    changes,
  });
}
```

4. **rewindToMessage 时执行回滚**

```typescript
rewindToMessage(sessionId: string, targetMessageId: string): boolean {
  const messages = this.listSessionMessages(sessionId);
  const targetIndex = messages.findIndex(m => m.id === targetMessageId);
  
  if (targetIndex === -1) {
    return false;
  }
  
  // 1. 保存截断后的消息
  const keptMessages = messages.slice(0, targetIndex + 1);
  this.saveSessionMessages(sessionId, keptMessages);
  
  // 2. 🔥 回滚文件系统状态
  this.rollbackFileSystem(targetMessageId);
  
  // 3. 更新 session 状态
  this.updateSessionEntry(sessionId, (entry) => ({
    ...entry,
    status: "completed",
    failReason: null,
    toolCalls: null,
    assistantReply: null,
    assistantThinking: null,
    updateTime: new Date().toISOString(),
  }));
  
  return true;
}

private rollbackFileSystem(targetMessageId: string): void {
  // 找到目标消息之后的所有文件变更
  const changesToRollback = this.fileChangeHistory.filter(
    record => {
      const recordIndex = this.fileChangeHistory.findIndex(
        r => r.messageId === targetMessageId
      );
      const currentIndex = this.fileChangeHistory.indexOf(record);
      return currentIndex > recordIndex;
    }
  );
  
  // 逆序回滚（从后往前）
  for (let i = changesToRollback.length - 1; i >= 0; i--) {
    const record = changesToRollback[i];
    for (const change of record.changes) {
      this.rollbackSingleChange(change);
    }
  }
}

private rollbackSingleChange(change: FileChange): void {
  if (change.type === 'create') {
    // 回滚创建：删除文件
    if (fs.existsSync(change.filePath)) {
      fs.unlinkSync(change.filePath);
    }
  } else if (change.type === 'modify') {
    // 回滚修改：恢复原内容
    if (change.previousContent !== undefined) {
      fs.writeFileSync(change.filePath, change.previousContent, 'utf8');
    }
  } else if (change.type === 'delete') {
    // 回滚删除：恢复文件
    if (!change.previousExists && change.previousContent !== undefined) {
      // 文件之前不存在，但现在被删除了，说明是新建后被删
      // 不需要恢复（因为之前就不存在）
    } else if (change.previousContent !== undefined) {
      fs.writeFileSync(change.filePath, change.previousContent, 'utf8');
    }
  }
}
```

**方案 B：Git 集成（适用于有 Git 的项目）**

如果项目在 Git 版本控制下，可以更优雅地处理：

```typescript
private async rollbackWithGit(
  sessionId: string,
  targetMessageId: string
): Promise<void> {
  // 1. 在 rewind 点创建临时标记
  // 2. 执行 git checkout -- . 恢复所有文件
  // 3. 或者使用 git stash 保存当前状态
  
  const bashHandler = this.getBashHandler();
  await bashHandler.execute(`git checkout -- .`, {
    cwd: this.projectRoot
  });
}
```

**方案 C：混合方案（生产级推荐）**

结合方案 A 和 B：
- 有 Git 的项目：使用 Git 回滚
- 无 Git 的项目：使用文件快照回滚
- 对于 Bash 工具的不可追踪操作（如 apt install）：发出警告

#### 限制与注意事项

⚠️ **无法完全回滚的场景：**

1. **Bash 工具的副作用**
   - 安装/卸载软件包（`npm install`, `apt-get install`）
   - 启动/停止服务
   - 修改系统配置
   - 网络请求（curl, wget）
   - 数据库操作

2. **外部系统状态**
   - API 调用产生的数据变更
   - 第三方服务状态
   - 浏览器缓存

3. **并发修改**
   - 用户在 rewind 后手动修改了文件
   - 其他进程修改了文件

**应对策略：**

```typescript
// 回滚前检查文件是否被外部修改
private isFileExternallyModified(change: FileChange): boolean {
  if (!fs.existsSync(change.filePath)) {
    return change.previousExists; // 之前存在现在不存在，可能被外部删除
  }
  
  const currentHash = this.computeFileHash(change.filePath);
  return currentHash !== change.previousHash;
}

// 回滚时给出警告
if (this.isFileExternallyModified(change)) {
  this.onAssistantMessage(
    this.buildSystemMessage(
      sessionId,
      `⚠️ File ${change.filePath} has been modified externally. ` +
      `Rewind may not fully restore the previous state.`,
      null,
      true
    ),
    false
  );
}
```

#### 数据存储

文件变更历史存储位置：

```typescript
// 方案 1：与消息一起存储（简单）
// ~/.deepcode/projects/{projectCode}/{sessionId}.jsonl
// 每条 tool message 的 metadata 中包含 fileChanges

// 方案 2：独立存储（推荐）
// ~/.deepcode/projects/{projectCode}/{sessionId}-file-changes.json
{
  "version": 1,
  "sessionId": "xxx",
  "changes": [
    {
      "messageId": "msg-123",
      "toolCallId": "call-456",
      "toolName": "write",
      "timestamp": "2025-05-19T14:30:00.000Z",
      "changes": [
        {
          "type": "create",
          "filePath": "/path/to/file.js",
          "previousContent": null,
          "previousExists": false
        }
      ]
    }
  ]
}
```

#### 性能优化

1. **大文件处理**
   - 不存储完整文件内容（> 1MB）
   - 只存储文件 hash 和元数据
   - 回滚时提示用户手动处理

2. **变更压缩**
   - 同一文件的多次修改只保留最后一次
   - 创建后立即删除的文件可以不记录

3. **清理策略**
   - Session 结束时清理文件变更历史
   - 或保留用于 undo 功能

### 数据安全

⚠️ **重要提示：**
- Rewind 操作**不可撤销**
- 删除的消息无法恢复（除非实现回收站机制）
- 建议在执行前添加确认提示

**确认提示方案：**
```
Rewind to this message? This will delete all subsequent messages.
[Yes] [Cancel]
```

## 🧪 测试计划

### 单元测试

1. **SessionManager.rewindToMessage()**
   - ✅ 成功回退到指定消息
   - ✅ 目标消息不存在时返回 false
   - ✅ 正确删除后续消息
   - ✅ 更新 session 状态
   - ✅ 处理空会话

2. **SessionManager.getRewindableMessages()**
   - ✅ 过滤系统消息
   - ✅ 过滤不可见消息
   - ✅ 只返回 user 和 assistant 消息

3. **Slash Command 解析**
   - ✅ 正确识别 /rewind 命令
   - ✅ 命令菜单中显示

4. **🔥 文件系统变更追踪**
   - ✅ Write Tool 创建文件时记录变更
   - ✅ Write Tool 修改文件时记录变更
   - ✅ Edit Tool 修改文件时记录变更
   - ✅ Bash Tool 删除文件时记录变更（rm 命令）
   - ✅ Bash Tool 移动文件时记录变更（mv 命令）
   - ✅ 大文件（> 1MB）不存储完整内容
   - ✅ 同一文件多次修改的压缩逻辑

5. **🔥 文件回滚逻辑**
   - ✅ 回滚文件创建（删除文件）
   - ✅ 回滚文件修改（恢复原内容）
   - ✅ 回滚文件删除（恢复文件）
   - ✅ 逆序回滚（从后往前）
   - ✅ 外部文件修改检测
   - ✅ 回滚失败时的错误处理

### 集成测试

1. 完整 rewind 流程
2. UI 交互（选择、取消）
3. 边界情况处理
4. Raw 模式兼容性

5. **🔥 文件系统回滚场景**
   - 场景 1: 回退到文件创建前
     - 验证文件被删除
   - 场景 2: 回退到文件修改前
     - 验证文件内容恢复
   - 场景 3: 回退到文件删除前
     - 验证文件被恢复
   - 场景 4: 多次文件操作后回退
     - 验证所有文件状态正确
   - 场景 5: 外部修改文件后回退
     - 验证警告提示显示
   - 场景 6: Bash 工具副作用
     - 验证不可回滚操作的警告
   - 场景 7: 大文件回滚
     - 验证性能和大文件处理

### 测试文件

- `src/tests/rewind.test.ts` - SessionManager 单元测试
- `src/tests/rewindCommand.test.ts` - 命令处理测试
- `src/tests/rewindMessageList.test.ts` - UI 组件测试
- `src/tests/fileChangeTracking.test.ts` - 🔥 文件变更追踪测试
- `src/tests/fileRollback.test.ts` - 🔥 文件回滚逻辑测试

## 📊 工作量评估

### 预计工作量：1-2 天

| 阶段 | 工作内容 | 预计时间 |
|------|---------|---------|
| **Phase 1** | SessionManager 核心逻辑 + 单元测试 | 0.5 天 |
| **Phase 2** | Slash command 集成 + 命令处理 | 0.25 天 |
| **Phase 3** | RewindMessageList UI 组件 | 0.75 天 |
| **Phase 4** | 边界处理 + 集成测试 | 0.5 天 |

### 代码量预估

- 核心逻辑：~50 行
- UI 组件：~200 行
- 测试代码：~150 行
- **总计：~400 行**

## 🔗 相关资源

### 参考实现

- `SessionList.tsx` - 消息列表 UI 参考
- `SlashCommandMenu.tsx` - 命令菜单交互模式
- `session.ts` - 消息持久化机制

### 相关文件

- `src/session.ts:1410-1428` - `listSessionMessages()`
- `src/session.ts:1536-1541` - `saveSessionMessages()`
- `src/session.ts:1543-1555` - `updateSessionEntry()`
- `src/ui/slashCommands.ts` - Slash command 定义
- `src/ui/PromptInput.tsx` - 命令处理逻辑

## 🚀 实施步骤

### Step 1: 核心逻辑实现
- [ ] 在 `SessionManager` 中添加 `rewindToMessage()` 方法
- [ ] 添加 `getRewindableMessages()` 辅助方法
- [ ] 编写单元测试

### Step 2: 命令集成
- [ ] 在 `slashCommands.ts` 中添加 rewind 定义
- [ ] 在 `PromptInput.tsx` 中添加命令处理
- [ ] 在 `App.tsx` 中添加 handler

### Step 3: UI 开发
- [ ] 创建 `RewindMessageList.tsx` 组件
- [ ] 实现键盘导航（↑↓ Enter ESC）
- [ ] 集成到 App 组件

### Step 4: 🔥 文件系统变更追踪
- [ ] 定义 `FileChangeRecord` 和 `FileChange` 类型
- [ ] 在 `ToolExecutionHooks` 中添加 `onFileChange` 回调
- [ ] 在 `write-handler.ts` 中实现文件变更追踪
- [ ] 在 `edit-handler.ts` 中实现文件变更追踪
- [ ] 在 `bash-handler.ts` 中追踪文件操作（cd, rm, mv, touch 等）
- [ ] 在 `SessionManager` 中存储变更历史
- [ ] 编写变更追踪单元测试

### Step 5: 🔥 文件回滚逻辑
- [ ] 实现 `rollbackFileSystem()` 方法
- [ ] 实现 `rollbackSingleChange()` 方法
- [ ] 处理 create/modify/delete 三种变更类型
- [ ] 实现外部修改检测 `isFileExternallyModified()`
- [ ] 添加用户警告提示
- [ ] 处理大文件优化（> 1MB 不存储内容）
- [ ] 编写回滚逻辑单元测试

### Step 6: 完善与测试
- [ ] 处理所有边界情况
- [ ] 添加错误提示和确认对话框
- [ ] 编写集成测试（含文件回滚场景）
- [ ] Raw 模式兼容性测试
- [ ] Bash 工具副作用警告测试

### Step 7: 文档与优化
- [ ] 更新用户文档（说明 rewind 的文件回滚能力）
- [ ] 性能优化（变更压缩、清理策略）
- [ ] 代码审查

## 💡 未来增强（可选）

### Phase 2+ 功能

1. **分支管理**
   - Rewind 时创建对话分支
   - 保留原对话历史
   - 分支切换功能

2. **回收站机制**
   - 临时保存删除的消息
   - 支持 undo 操作
   - 自动清理（24 小时后）

3. **消息搜索**
   - 在 rewind 列表中搜索消息
   - 按日期过滤
   - 按角色过滤

4. **批量操作**
   - 选择多个消息点
   - 对比不同分支

## 📌 注意事项

1. **数据安全优先**
   - 实现确认提示
   - 考虑回收站机制
   - 记录操作日志
   - 🔥 **文件回滚前备份当前状态**

2. **用户体验**
   - 清晰的错误提示
   - 流畅的交互流程
   - 响应式的 UI
   - 🔥 **明确告知用户文件将被回滚**
   - 🔥 **警告无法回滚的操作（Bash 副作用）**

3. **代码质量**
   - 完整的测试覆盖
   - 符合代码规范
   - 清晰的注释文档
   - 🔥 **文件变更追踪的性能优化**

4. **性能考虑**
   - 大消息列表的虚拟滚动
   - 文件操作的原子性
   - 内存使用控制
   - 🔥 **大文件不存储完整内容（> 1MB）**
   - 🔥 **变更压缩（同一文件多次修改只保留最后一次）**

5. **🔥 文件系统状态同步**
   - 确保消息历史与文件状态一致
   - 处理外部文件修改的检测和警告
   - Bash 工具副作用的明确提示
   - 回滚失败时的降级处理

## 🎯 成功标准

- ✅ 用户可以通过 `/rewind` 命令回退到任意消息
- ✅ UI 交互流畅，支持键盘操作
- ✅ 所有边界情况得到妥善处理
- ✅ 测试覆盖率 > 80%
- ✅ 无性能退化
- ✅ 文档完整清晰
- ✅ **🔥 文件状态与消息历史保持一致**
- ✅ **🔥 文件回滚准确率 > 95%（排除 Bash 副作用）**
- ✅ **🔥 外部文件修改检测与警告正常工作**
- ✅ **🔥 用户明确了解哪些操作可以/不可以回滚**

---

**创建时间：** 2025-05-19  
**优先级：** Medium  
**标签：** `feature` `enhancement` `ui` `session-management`
