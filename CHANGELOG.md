# Changelog

All notable changes to [Deep Code](https://github.com/lessweb/deepcode-cli) are
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Only stable releases
are listed; pre-releases are intentionally omitted.

> **This file is generated automatically** from
> [GitHub Releases](https://github.com/lessweb/deepcode-cli/releases). Do not
> edit it by hand — run `npm run changelog` to regenerate.

## [0.1.31](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.31) - 2026-06-16

### Other

- chore(deps-dev): bump esbuild and tsx ([#174](https://github.com/lessweb/deepcode-cli/pull/174))

## [0.1.30](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.30) - 2026-06-15

### Fixed

- mcp: fix Windows MCP spawn double-quoting that breaks all MCP servers ([#164](https://github.com/lessweb/deepcode-cli/pull/164))

## [0.1.29](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.29) - 2026-06-09

### Other

- 修复提示输入的换行、光标定位与 busy 状态显示 ([#171](https://github.com/lessweb/deepcode-cli/pull/171))

## [0.1.28](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.28) - 2026-06-05

### Added

- session name can be edited now ([#159](https://github.com/lessweb/deepcode-cli/pull/159))
- ui: 优化 PromptInput 组件的光标显示与布局 ([#161](https://github.com/lessweb/deepcode-cli/pull/161))

### Changed

- extract OpenAI message converter from SessionManager ([#140](https://github.com/lessweb/deepcode-cli/pull/140))

## [0.1.27](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.27) - 2026-06-01

### Other

- chore(deps): update ink-gradient to 4.0.1 ([#135](https://github.com/lessweb/deepcode-cli/pull/135))
- chore: 更新API Key not found时的文本显示 ([#137](https://github.com/lessweb/deepcode-cli/pull/137))

## [0.1.26](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.26) - 2026-05-29

### Changed

- ui: 重构代码结构，调整文件路径和导入引用 ([#122](https://github.com/lessweb/deepcode-cli/pull/122))
- extract telemetry into separate module with enable/disable toggle ([#130](https://github.com/lessweb/deepcode-cli/pull/130))

### Fixed

- session: 修复会话清理内存泄漏并补充回归测试 ([#123](https://github.com/lessweb/deepcode-cli/pull/123))
- prompt-buffer: 修正 getCurrentSlashToken 函数逻辑 ([#129](https://github.com/lessweb/deepcode-cli/pull/129))

### Other

- chore(deps): 更新 ink 依赖到 7.0.4 版本 ([#125](https://github.com/lessweb/deepcode-cli/pull/125))

## [0.1.25](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.25) - 2026-05-25

### Added

- ui: add bracketed paste with large-paste marker collapsing ([#102](https://github.com/lessweb/deepcode-cli/pull/102))
- ui: 会话列表支持 Delete 键删除会话 ([#114](https://github.com/lessweb/deepcode-cli/pull/114))
- ui: 增加会话删除及相关UI重置功能 ([#119](https://github.com/lessweb/deepcode-cli/pull/119))
- markdown 表格闭合边框渲染 + CJK/emoji 宽度适配 ([#115](https://github.com/lessweb/deepcode-cli/pull/115))

### Fixed

- permission: 处理权限拒绝状态与界面更新 ([#120](https://github.com/lessweb/deepcode-cli/pull/120))

### Performance

- reuse OpenAI client and add undici keep-alive Agent with connection warmup ([#100](https://github.com/lessweb/deepcode-cli/pull/100))

### Documentation

- 更新扩展命令菜单说明和帮助文档 ([#109](https://github.com/lessweb/deepcode-cli/pull/109))

## [0.1.24](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.24) - 2026-05-21

### Added

- MCP 服务器手动重连功能 ([#84](https://github.com/lessweb/deepcode-cli/pull/84))

### Changed

- Extract dropdown components ([#97](https://github.com/lessweb/deepcode-cli/pull/97))
- ui: 使用 resetPromptInput 简化撤销和回绕处理 ([#101](https://github.com/lessweb/deepcode-cli/pull/101))

### Fixed

- ui: 修正组件路径拼写错误 ([#93](https://github.com/lessweb/deepcode-cli/pull/93))
- resolve CJK composition bug on iOS terminals (backspace packet splitting) ([#94](https://github.com/lessweb/deepcode-cli/pull/94))

## [0.1.23](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.23) - 2026-05-19

### Added

- 新增 `/raw` 命令交互与终端消息直出 ([#89](https://github.com/lessweb/deepcode-cli/pull/89))
- notify: pass STATUS, FAIL_REASON, BODY, TITLE as env vars to notify hook ([#90](https://github.com/lessweb/deepcode-cli/pull/90))

## [0.1.22](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.22) - 2026-05-18

### Added

- add -p/--prompt flag to auto-submit prompt on launch ([#86](https://github.com/lessweb/deepcode-cli/pull/86))
- Add Ctrl+O live process stdout viewer ([#75](https://github.com/lessweb/deepcode-cli/pull/75))

## [0.1.21](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.21) - 2026-05-16

### Added

- 添加 GitHub CI 工作流，支持多平台多版本自动验证 ([#76](https://github.com/lessweb/deepcode-cli/pull/76))

### Changed

- MCP 新增状态管理增强与 UI 可视化 ([#72](https://github.com/lessweb/deepcode-cli/pull/72))

### Fixed

- resolve Windows CI failures (CRLF, MCP spawn, cross-platform test runner) ([#77](https://github.com/lessweb/deepcode-cli/pull/77))

### Documentation

- add English translations of configuration.md and mcp.md ([#56](https://github.com/lessweb/deepcode-cli/pull/56))

### Other

- style(DropdownMenu): 调整内边距优化下拉菜单布局 ([#73](https://github.com/lessweb/deepcode-cli/pull/73))

## [0.1.20](https://github.com/lessweb/deepcode-cli/releases/tag/v0.1.20) - 2026-05-14

### Added

- add MCP (Model Context Protocol) support with /mcp command ([#48](https://github.com/lessweb/deepcode-cli/pull/48))
- Handle Shift+Enter as prompt newline ([#52](https://github.com/lessweb/deepcode-cli/pull/52))
- 新增 DropdownMenu 组件 ([#58](https://github.com/lessweb/deepcode-cli/pull/58))
- Add prompt undo and redo shortcuts ([#59](https://github.com/lessweb/deepcode-cli/pull/59))
- ui: 优化消息视图的布局和宽度自适应 ([#66](https://github.com/lessweb/deepcode-cli/pull/66))

### Changed

- session: 简化并统一会话系统消息的处理逻辑 ([#62](https://github.com/lessweb/deepcode-cli/pull/62))

### Fixed

- improve Windows Git Bash detection ([#55](https://github.com/lessweb/deepcode-cli/pull/55))
- ui: 修正 reasoningEffort 显示逻辑 ([#63](https://github.com/lessweb/deepcode-cli/pull/63))
- session: 修复系统消息可见性设置错误 ([#64](https://github.com/lessweb/deepcode-cli/pull/64))
- filter image_url content from API messages for DeepSeek compatibility ([#51](https://github.com/lessweb/deepcode-cli/pull/51))
