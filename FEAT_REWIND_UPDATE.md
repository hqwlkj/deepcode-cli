# /rewind 功能更新说明

## 📅 更新日期
2025-05-19

## 🔥 重要补充：文件系统状态回滚

### 问题发现

在原始分析中，遗漏了一个关键问题：**`/rewind` 不仅仅是消息历史的回退，还涉及到文件系统状态的还原。**

### 典型场景

```
对话流程：
1. User: "创建一个 utils.js 文件"
2. Assistant: [Write Tool] 创建 utils.js
3. User: "删除 utils.js，改用 utils.ts"
4. Assistant: [Bash Tool] 删除 utils.js, [Write Tool] 创建 utils.ts
5. User: "重构代码结构"
6. Assistant: [Edit Tool] 修改多个文件

用户执行: /rewind 到消息 3

❌ 错误结果（只回退消息）：
   - 消息历史回到消息 3
   - 但文件系统仍然是消息 6 的状态
   - utils.js 不存在（已被删除）
   - utils.ts 存在（已被创建）
   - 其他文件被修改

✅ 正确结果（消息 + 文件同步回退）：
   - 消息历史回到消息 3
   - utils.js 存在（消息 2 创建的）
   - utils.ts 不存在（消息 4 才创建）
   - 其他文件回到消息 3 时的状态
```

### 解决方案

#### 方案 A：文件系统快照（MVP 推荐）

**核心思路：** 在每次工具执行时记录文件变更，回退时逆序还原。

**实现要点：**

1. **定义变更类型**
```typescript
type FileChange = {
  type: 'create' | 'modify' | 'delete';
  filePath: string;
  previousContent?: string;  // 变更前的内容
  previousExists: boolean;   // 变更前是否存在
  previousHash?: string;     // 文件 hash
};
```

2. **在 Tool Handler 中追踪变更**
   - `write-handler.ts`: 记录文件创建/覆盖
   - `edit-handler.ts`: 记录文件修改
   - `bash-handler.ts`: 追踪 rm, mv, touch 等命令

3. **回滚逻辑**
   - 逆序执行（从后往前）
   - create → 删除文件
   - modify → 恢复原内容
   - delete → 恢复文件

#### 方案 B：Git 集成（有 Git 的项目）

```bash
# 在 rewind 点执行
git checkout -- .
```

#### 方案 C：混合方案（生产级推荐）

- 有 Git → 使用 Git 回滚
- 无 Git → 使用文件快照
- Bash 副作用 → 发出警告

### 无法完全回滚的场景

⚠️ **Bash 工具的副作用：**
- 安装/卸载软件包（`npm install`, `apt-get install`）
- 启动/停止服务
- 修改系统配置
- 网络请求（curl, wget）
- 数据库操作

**应对策略：**
- 执行 rewind 前发出明确警告
- 列出无法回滚的操作
- 让用户确认是否继续

### 实现影响

#### 工作量变化

| 项目 | 原始 | 更新后 |
|------|------|--------|
| 预计时间 | 1-2 天 | 3-5 天 |
| 代码量 | ~400 行 | ~850 行 |
| 新增阶段 | 4 个 | 7 个 |

#### 新增文件

- `src/common/file-change-tracker.ts` - 文件变更追踪模块
- `src/tests/fileChangeTracking.test.ts` - 变更追踪测试
- `src/tests/fileRollback.test.ts` - 回滚逻辑测试

#### 修改文件

- `src/tools/executor.ts` - 添加 `onFileChange` 回调
- `src/tools/write-handler.ts` - 实现变更追踪
- `src/tools/edit-handler.ts` - 实现变更追踪
- `src/tools/bash-handler.ts` - 追踪文件操作
- `src/session.ts` - 添加回滚逻辑

### 性能优化

1. **大文件处理**
   - > 1MB 的文件不存储完整内容
   - 只存储 hash 和元数据
   - 回滚时提示用户手动处理

2. **变更压缩**
   - 同一文件的多次修改只保留最后一次
   - 创建后立即删除的文件可以不记录

3. **清理策略**
   - Session 结束时清理变更历史
   - 或保留用于 undo 功能

### 用户体验改进

1. **确认提示**
```
⚠️ Rewind 将执行以下操作：

📝 消息回退：
  - 删除 3 条消息

📁 文件回滚：
  - 删除: utils.ts
  - 恢复: utils.js (修改前状态)
  - 恢复: config.json (修改前状态)

⚠️ 无法回滚的操作：
  - npm install (已安装的包不会卸载)

是否继续？ [Yes] [Cancel]
```

2. **警告提示**
```
⚠️ File /path/to/file.js has been modified externally.
Rewind may not fully restore the previous state.
```

### 成功标准更新

新增：
- ✅ 文件状态与消息历史保持一致
- ✅ 文件回滚准确率 > 95%（排除 Bash 副作用）
- ✅ 外部文件修改检测与警告正常工作
- ✅ 用户明确了解哪些操作可以/不可以回滚

### 测试场景更新

新增 7 个集成测试场景：
1. 回退到文件创建前
2. 回退到文件修改前
3. 回退到文件删除前
4. 多次文件操作后回退
5. 外部修改文件后回退
6. Bash 工具副作用
7. 大文件回滚

## 📊 总结

这次补充使 `/rewind` 功能从**简单的消息回退**升级为**完整的对话状态回滚**，包括：

- ✅ 消息历史回退
- ✅ 文件系统状态还原
- ✅ 外部修改检测
- ✅ 不可回滚操作警告
- ✅ 性能和用户体验优化

这使得功能更加完整和实用，但也增加了实现复杂度（工作量翻倍）。

---

**建议实施策略：**

**Phase 1 (MVP):** 只实现消息回退，文件回滚标记为实验性
**Phase 2:** 完善文件回滚逻辑
**Phase 3:** 添加 Git 集成和优化

