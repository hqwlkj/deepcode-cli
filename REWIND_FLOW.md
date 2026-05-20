# /rewind 功能操作流程图

## 📋 功能概述

`/rewind` 命令允许用户回退到对话历史中的任意消息位置，并自动回滚该消息之后的所有文件变更，为用户提供对话分支管理能力。

---

## 🎯 完整操作流程图

```
用户输入 /rewind
    │
    ├─▶ 检查活跃会话 ────────────── 否 ──▶ ❌ "No active session"
    │
   是
    │
    ├─▶ 获取会话消息列表
    │
    ├─▶ 过滤可回退消息
    │    条件：visible=true AND (role=user OR assistant)
    │          排除最后一条消息
    │
    ├─▶ 消息列表为空？ ──────────── 是 ──▶ ❌ "无可回退消息"
    │
   否
    │
    ├─▶ 显示 RewindMessageList 组件
    │    ┌─────────────────────────────────┐
    │    │ Select message to rewind to:    │
    │    │   ○ User (14:32) - "How to..." │
    │    │   ○ Assistant (14:32) - "I'll..│
    │    │ > User (14:35) - "Can we use..│ ◀── 用户选择
    │    │   ○ Assistant (14:35) - "Yes..│
    │    │                                 │
    │    │ Press Enter to select,          │
    │    │ ESC to cancel                   │
    │    └─────────────────────────────────┘
    │
    ├─▶ 用户操作
    │    ├─ ESC ──▶ 取消，返回正常聊天
    │    ├─ ↑/↓ ──▶ 上下键浏览消息
    │    └─ Enter ──▶ 确认选择目标消息
    │
    ├─▶ 目标消息存在？ ──────────── 否 ──▶ ❌ "Message not found"
    │
   是
    │
    ├─▶ ═══════════════════════════════════
    │   执行 rewindToMessage() 核心流程
    │   ═══════════════════════════════════
    │
    │   ┌─ 步骤 1: 消息截断 ─────────────────────────┐
    │   │  targetIndex = findIndex(targetMessageId)  │
    │   │  keptMessages = messages.slice(0, targetIndex+1) │
    │   │  saveSessionMessages(sessionId, keptMessages) │
    │   └────────────────────────────────────────────┘
    │
    │   ┌─ 步骤 2: 文件系统回滚 ─────────────────────┐
    │   │  rollbackFileSystem(targetIndex, messages) │
    │   │                                            │
    │   │  getChangesAfter(targetIndex, messages)   │
    │   │         │                                  │
    │   │         ├─ 有变更记录？                    │
    │   │         │   ├─ 否 ──▶ 跳过回滚             │
    │   │         │   └─ 是 ──▶ 判断项目类型         │
    │   │         │           │                      │
    │   │         │           ├─ Git 仓库？          │
    │   │         │           │   ├─ 是              │
    │   │         │           │   │  git rev-parse   │
    │   │         │           │   │  ──is-inside     │
    │   │         │           │   │  ──work-tree     │
    │   │         │           │   │                  │
    │   │         │           │   │  逆序遍历变更：  │
    │   │         │           │   │  ┌────────────┐ │
    │   │         │           │   │  │ modify:    │ │
    │   │         │           │   │  │ git ls-fil│ │
    │   │         │           │   │  │ ──error-un│ │
    │   │         │           │   │  │ ──match?  │ │
    │   │         │           │   │  │  ├─ 是    │ │
    │   │         │           │   │  │  │ git che│ │
    │   │         │           │   │  │  │ ─ckout │ │
    │   │         │           │   │  │  │ ─HEAD  │ │
    │   │         │           │   │  │  └─ 否    │ │
    │   │         │           │   │  │  fs.write │ │
    │   │         │           │   │  │  ─FileSync│ │
    │   │         │           │   │  └────────────┘ │
    │   │         │           │   │  ┌────────────┐ │
    │   │         │           │   │  │ create:    │ │
    │   │         │           │   │  │ fs.unlink  │ │
    │   │         │           │   │  └────────────┘ │
    │   │         │           │   │  ┌────────────┐ │
    │   │         │           │   │  │ delete:    │ │
    │   │         │           │   │  │ git track? │ │
    │   │         │           │   │  │  ├─ 是    │ │
    │   │         │           │   │  │  │ git che│ │
    │   │         │           │   │  │  └─ 否    │ │
    │   │         │           │   │  │  fs.write │ │
    │   │         │           │   │  └────────────┘ │
    │   │         │           │   └─ 否（快照模式） │
    │   │         │           │      逆序遍历变更：  │
    │   │         │           │      ┌────────────┐ │
    │   │         │           │      │ modify:    │ │
    │   │         │           │      │ fs.write   │ │
    │   │         │           │      │ ─Sync(prev │ │
    │   │         │           │      └────────────┘ │
    │   │         │           │      ┌────────────┐ │
    │   │         │           │      │ create:    │ │
    │   │         │           │      │ fs.unlink  │ │
    │   │         │           │      └────────────┘ │
    │   │         │           │      ┌────────────┐ │
    │   │         │           │      │ delete:    │ │
    │   │         │           │      │ fs.write   │ │
    │   │         │           │      │ ─Sync(prev │ │
    │   │         │           │      └────────────┘ │
    │   │         │                                │
    │   │         ├─ 回滚失败？                    │
    │   │         │   └─ 是 ──▶ 添加警告到数组     │
    │   │         └────────────────────────────────┘
    │   └────────────────────────────────────────────┘
    │
    │   ┌─ 步骤 3: 收集 Bash 不可追踪操作警告 ──────┐
    │   │  getUntrackableCommandsAfter(targetIndex) │
    │   │                                            │
    │   │  识别模式（20+ 种）：                      │
    │   │  ├─ apt-get install/remove/purge          │
    │   │  ├─ npm install (global)                  │
    │   │  ├─ yarn/pnpm add/remove                  │
    │   │  ├─ pip install/uninstall                 │
    │   │  ├─ brew install                          │
    │   │  ├─ docker run/pull/build                 │
    │   │  ├─ curl/wget | bash                      │
    │   │  ├─ systemctl start/stop                  │
    │   │  ├─ mysql/psql/mongo 操作                 │
    │   │  └─ ...                                   │
    │   │                                            │
    │   │  生成警告：                                │
    │   │  "Untrackable bash operation:              │
    │   │   '{command}' — {reason}"                 │
    │   └────────────────────────────────────────────┘
    │
    │   ┌─ 步骤 4: 清理追踪器 ──────────────────────┐
    │   │  fileChangeTracker.clear()                │
    │   │  - 清空 changes 数组                      │
    │   │  - 清空 untrackableCommands 数组          │
    │   └────────────────────────────────────────────┘
    │
    │   ┌─ 步骤 5: 更新 Session 状态 ───────────────┐
    │   │  updateSessionEntry:                      │
    │   │    status = "completed"                   │
    │   │    failReason = null                      │
    │   │    toolCalls = null                       │
    │   │    assistantReply = null                  │
    │   │    assistantThinking = null               │
    │   │    updateTime = now                       │
    │   └────────────────────────────────────────────┘
    │
    │   ┌─ 返回结果 ─────────────────────────────────┐
    │   │  {                                         │
    │   │    success: true,                         │
    │   │    warnings: [...fileWarnings,            │
    │   │               ...bashWarnings]            │
    │   │  }                                        │
    │   └────────────────────────────────────────────┘
    │
    ├─▶ 有警告？
    │    ├─ 是 ──▶ ⚠️ 显示警告列表
    │    │         "文件回滚失败 + Bash 副作用"
    │    └─ 否 ──▶ ✅ "回退成功"
    │              消息列表刷新
    │              文件状态已恢复
    │
    └─▶ [新状态：可继续对话]
```

---

## 🔍 核心流程分解

### 1️⃣ 用户触发阶段

```
用户输入 /rewind
    ↓
检查活跃会话
    ↓
获取可回退消息（过滤条件）：
  - visible = true
  - role = "user" 或 "assistant"
  - 排除最后一条消息（不能回退到对话末尾）
    ↓
显示消息选择列表（RewindMessageList）
    ↓
用户选择目标消息
```

### 2️⃣ 消息截断阶段

```typescript
rewindToMessage(sessionId, targetMessageId)
    ↓
找到目标消息索引 targetIndex
    ↓
截断消息列表：
  keptMessages = messages.slice(0, targetIndex + 1)
    ↓
保存到磁盘：
  saveSessionMessages(sessionId, keptMessages)
```

### 3️⃣ 文件系统回滚阶段

```
rollbackFileSystem(targetIndex, messages)
    ↓
获取目标消息后的文件变更记录：
  getChangesAfter(targetIndex, messages)
    ↓
判断项目类型：
  isGitRepo(projectRoot)?
    ├─ 是 → Git 回滚模式
    │    对每个变更：
    │      ├─ modify → git ls-files --error-unmatch?
    │      │              ├─ 是 → git checkout HEAD -- file
    │      │              └─ 否 → fs.writeFileSync(previousContent)
    │      ├─ create → fs.unlinkSync(file)
    │      └─ delete → git ls-files --error-unmatch?
    │                     ├─ 是 → git checkout HEAD -- file
    │                     └─ 否 → fs.writeFileSync(previousContent)
    │
    └─ 否 → 快照回滚模式
         对每个变更：
           ├─ modify → fs.writeFileSync(previousContent)
           ├─ create → fs.unlinkSync(file)
           └─ delete → fs.writeFileSync(previousContent) 或创建空文件
    ↓
逆序执行（latest → earliest）
    ↓
捕获异常 → 添加到 warnings 数组
```

### 4️⃣ Bash 副作用警告收集阶段

```
getUntrackableCommandsAfter(targetIndex, messages)
    ↓
遍历不可追踪命令：
  ├─ apt-get install/remove/purge
  ├─ npm install (global)
  ├─ brew install
  ├─ pip install
  ├─ docker run/pull/build
  ├─ curl | bash
  ├─ systemctl start/stop
  ├─ mysql/psql/mongo 操作
  └─ ... (20+ 种模式)
    ↓
生成警告信息：
  "Untrackable bash operation: '{command}' — {reason}"
    ↓
合并到最终 warnings 数组
```

### 5️⃣ 清理与状态更新阶段

```
fileChangeTracker.clear()
    ↓
updateSessionEntry:
  status = "completed"
  failReason = null
  toolCalls = null
  assistantReply = null
  assistantThinking = null
  updateTime = now
    ↓
返回结果：
  { success: true, warnings: [...fileWarnings, ...bashWarnings] }
```

---

## 🔄 文件变更追踪流程（前置准备）

在对话过程中，工具执行时自动记录文件变更：

```
工具执行
    │
    ├─▶ 判断工具类型
    │    ├─ write/edit 工具
    │    │    │
    │    │    └─▶ captureBeforeChange()
    │    │         记录文件创建/修改前的状态
    │    │         ├─ 文件存在？
    │    │         │   ├─ 是 → type = "modify"
    │    │         │   │        previousContent = readFileSync()
    │    │         │   │        previousExists = true
    │    │         │   └─ 否 → type = "create"
    │    │         │            previousContent = null
    │    │         │            previousExists = false
    │    │         │
    │    │         └─▶ recordChange()
    │    │              记录到 fileChangeTracker
    │    │
    │    └─ bash 工具
    │         │
    │         └─▶ trackBashFileChanges()
    │              追踪 rm/mv/touch 等文件操作
    │              │
    │              ├─▶ 判断是否不可追踪命令？
    │              │    classifyUntrackable()
    │              │    检查 20+ 种模式：
    │              │    ├─ apt/yum/pip/npm install
    │              │    ├─ docker run/pull
    │              │    ├─ curl | bash
    │              │    ├─ systemctl start/stop
    │              │    └─ ... (共 20+ 种)
    │              │    │
    │              │    ├─ 是 → recordUntrackableCommand()
    │              │    │        记录到 untrackableCommands
    │              │    │        触发 onUntrackableBashCommand 回调
    │              │    │
    │              │    └─ 否 → 继续追踪文件操作
    │              │
    │              ├─▶ rm 命令 → recordDelete()
    │              │    type = "delete"
    │              │    previousContent = readFileSync() (如果文件还存在)
    │              │    previousExists = true
    │              │
    │              └─▶ mv 命令 → 两条记录
    │                   ├─ 源文件：type = "delete"
    │                   └─ 目标文件：type = "create"
    │
    ├─▶ 变更记录先存入缓冲区
    │    ├─ pendingFileChanges
    │    └─ pendingUntrackableCommands
    │
    ├─▶ flushPendingFileChanges()
    │    关联真实的 messageId 和 toolCallId
    │    从缓冲区转移到 fileChangeTracker
    │
    └─▶ fileChangeTracker 持久化
         等待 rewind 时使用
```

---

## ⚠️ 边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 目标消息不存在 | 返回 `{ success: false, warnings: [] }` |
| 当前没有活跃会话 | 提示 "No active session to rewind" |
| 目标是最后一条消息 | 过滤时已排除，不会显示在选择列表 |
| 目标是系统消息 | 过滤条件 `role === "user" \|\| "assistant"` |
| 后台任务正在运行 | 先调用 `interruptActiveSession()` |
| 文件已被外部修改 | 回滚失败 → 添加到 warnings |
| Git 追踪文件 | 优先使用 `git checkout HEAD` |
| 大文件（> 1MB） | 不存储 `previousContent`，回滚时可能失败 |
| Bash 不可追踪操作 | 收集警告并返回给用户 |

---

## 🎨 用户交互流程

```
┌─────────────────────────────────────────────────┐
│  用户输入: /rewind                               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Select message to rewind to:                    │
│                                                  │
│    ○ User (14:32) - "How to implement auth..."  │
│    ○ Assistant (14:32) - "I'll help you..."     │
│  > User (14:35) - "Can we use JWT?"             │  ← 用户选择
│    ○ Assistant (14:35) - "Yes, JWT is..."       │
│                                                  │
│  Press Enter to select, ESC to cancel            │
└─────────────────────────────────────────────────┘
                    ↓ (Enter)
┌─────────────────────────────────────────────────┐
│  ⚠️ Rewind 执行中...                             │
│                                                  │
│  📝 消息回退：                                    │
│    - 删除 3 条消息                               │
│                                                  │
│  📁 文件回滚：                                    │
│    - 删除: utils.ts (创建)                       │
│    - 恢复: utils.js (修改前状态)                 │
│    - 恢复: config.ts (修改前状态)                │
│                                                  │
│  ⚠️ 无法回滚的操作：                              │
│    - npm install (已安装的包不会卸载)            │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  ✅ Rewind 成功！                                │
│                                                  │
│  已回退到: "Can we use JWT?"                     │
│  ⚠️ 有 1 条警告需要注意                          │
│                                                  │
│  [继续对话]                                      │
└─────────────────────────────────────────────────┘
```

---

## 📊 数据流向

```
消息历史 (JSONL)          文件变更追踪器 (内存)
    ↓                          ↓
listSessionMessages()     fileChangeTracker
    ↓                          ↓
    ├─ targetIndex         getChangesAfter()
    └─ keptMessages            ↓
         ↓                FileChangeRecord[]
saveSessionMessages()           ↓
         ↓                rollback(projectRoot)
         ↓                    ↓
    持久化到磁盘          Git 或快照回滚
                               ↓
                         文件系统状态恢复
                               ↓
                    getUntrackableCommandsAfter()
                               ↓
                         生成 warnings
                               ↓
                    更新 Session 状态
                               ↓
                         返回 {success, warnings}
```

---

## 🔧 涉及的核心文件

| 文件 | 职责 |
|------|------|
| `src/session.ts` | `rewindToMessage()` 核心逻辑、`rollbackFileSystem()` |
| `src/common/file-change-tracker.ts` | 文件变更追踪、Git helpers、回滚执行 |
| `src/tools/executor.ts` | `onFileChange` / `onUntrackableBashCommand` 回调 |
| `src/tools/bash-handler.ts` | `classifyUntrackable()` 识别不可追踪命令 |
| `src/tools/write-handler.ts` | write 工具变更前捕获 |
| `src/tools/edit-handler.ts` | edit 工具变更前捕获 |

---

## 🎯 成功标准

- ✅ 消息历史正确截断
- ✅ 文件状态与消息历史一致
- ✅ Git 项目优先使用 Git 回滚
- ✅ 非 Git 项目使用快照回滚
- ✅ Bash 不可追踪操作明确警告
- ✅ 回滚失败时给出详细错误信息
- ✅ 用户体验流畅，交互清晰

