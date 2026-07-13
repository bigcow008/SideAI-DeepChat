# WindowFollower 容器融合自动验证记录

日期：2026-07-13

## 结论边界

本记录只证明自动验证已执行，不代表当前实现可交付。Electron 人工验收、推送、PR 和 `main` 晋升均未完成；用户明确验收前不得更新为完成状态。

验证使用正式 worktree：

```text
/Users/mac123/.config/superpowers/worktrees/SideAI-DeepChat/window-follower-integration
```

- 分支：`sideai/window-follower-integration`
- 自动验证开始时 HEAD：`3c18af38b864c818bcd948079d3e38f14e205699`
- 远端分支 SHA：`3ed388fb81639dcc4bc6041fa4e723eb9a55b9ec`
- Node：`24.14.1`

## 定向测试

1. WindowFollower 主进程、renderer、弹层、引导、历史与窄布局回归：exit `0`。
   - 28 个测试文件通过。
   - 209 项测试通过。
2. DeepChat 原生能力回归：exit `0`。
   - 26 个测试文件通过，1 个测试文件跳过。
   - 714 项测试通过，18 项跳过。
   - 覆盖 dispatcher、Agent runtime/session、ChatInputToolbar、ChatStatusBar 和 MessageList；Provider、Agent、CLI、MCP、技能、工具与 CUA 继续走 DeepChat 原路径。

## 全量门禁

| 命令 | Exit code | 结果 |
| --- | ---: | --- |
| `pnpm run format` | 0 | 2095 个文件完成格式化扫描 |
| `pnpm run i18n` | 0 | 无缺失 key，无无效翻译 |
| `pnpm run lint` | 0 | cleanup guard、architecture guard 和 oxlint 通过 |
| `pnpm run typecheck` | 0 | node 与 web 类型检查通过 |
| `pnpm run format:check` | 0 | 格式检查通过 |
| `pnpm test -- --run` | 1 | 仅 5 项官方基线失败，无新增失败 |
| `pnpm run build` | 0 | Electron main/preload/renderer 构建通过；仅保留既有大 chunk 警告 |
| `git diff --check` | 0 | 无空白错误 |

全量测试计数：

- 480 个测试文件通过，11 个跳过，3 个失败。
- 4670 项测试通过，145 项跳过，5 项失败。
- `SpotlightOverlay.test.ts` 3 项：未激活 Pinia。
- `agentSessionPresenter/integration.test.ts` 1 项：rebudget 既有断言。
- `createMockChatSession.test.ts` 1 项：plan block 既有断言。

以上 5 项均已在未修改官方 v1.0.9 复现，与交接基线一致。

## 生成资源

build 前后哈希：

| 文件 | build 前 | build 后 | 结果 |
| --- | --- | --- | --- |
| `resources/acp-registry/registry.json` | `310f67d1c99e45e440f1909ea12fb17e89eb68d5` | `7ebfc00dd6942852b85f6ea59c6b038d23224cb4` | 已刷新 |
| `resources/model-db/providers.json` | `a5d1f382de5d71f1d9ec2729277c4b5bf9c37ea6` | 相同 | 未变化 |
| `src/renderer/src/lib/icons/icon-collections.generated.ts` | `a2435743fdeabf52b340472033951846773fd95e` | 相同 | 未变化 |

ACP registry 刷新内容：`fast-agent` 0.9.5 -> 0.9.6、`grok-build` 0.2.98 -> 0.2.99、`harn` 0.10.11 -> 0.10.12 及对应分发地址。

## 架构边界

以下检查均 exit `0`：

- `vendor/deepchat` 不存在。
- 相对 `upstream/main` 未修改 `.env.example`。
- `src/renderer/src` 与 `src/renderer/api` 未出现 `SIDEAI_PROXY`、`DEEPSEEK_API_KEY` 或 `ipcRenderer.invoke/send`。
- `.superpowers/` 仍未跟踪，未进入提交。

## 同一窗口自动证据

`test/main/windowFollower/windowFollowerPresenter.test.ts` 的 `switches the same BrowserWindow to a non-activating attached panel and back` 用同一个 window mock 保存初始 `webContents.id`，依次进入 `following` 并返回 `normal`，两次均断言 ID 不变。该测试包含在 209 项 WindowFollower 定向回归中并通过。

这证明模式切换代码没有创建替代窗口；normal、panel、collapsed 的真实运行时 ID 仍需在 Electron 人工验收中通过调试页或日志确认。

## 待人工验收

- [ ] 普通窗口仅一个应用窗口、完整布局、无自动 DevTools。
- [ ] 单显示器 reserve 完全透明且鼠标穿透；多显示器、负坐标和上下排列无假 reserve。
- [ ] 旧 SideAI 全部工具栏按钮存在，按钮组横向折叠与气泡折叠相互独立。
- [ ] 固定、脱吸附、拖动、原地展开、宽度拖动/重置、设置、隐藏和退出正常。
- [ ] 新对话可见性、历史浮层分页/切换、恢复大窗口无 reload。
- [ ] 草稿、流式任务、Provider、自定义 Key、Agent、附件、CLI、MCP、技能、工具、CUA 和真实聊天正常。
- [ ] normal、panel、collapsed 全程保持同一个运行时 `BrowserWindow` / `webContents.id`。

## 2026-07-13 合并前代码审核补充

代码审核发现自动验证未覆盖的恢复 following、排除应用隐藏、非 macOS 默认贴边、原生读取超时和显式隐藏保持问题，现已补齐失败测试并修复。普通大窗口新增权限与自动贴边恢复入口，用户无需先进入 panel 即可完成授权或重新启用。

补充验证结果：

- WindowFollower、主窗口、routes 和 App 定向回归：21 个测试文件、213 项通过。
- `pnpm run i18n`、`pnpm run lint`、`pnpm run typecheck`：通过。
- 全量测试：481 个文件通过、11 个跳过，4679 项通过、145 项跳过；仍只有前述 5 项官方基线失败。
- `pnpm run build`：完成，`out/main/index.js`、`out/preload/index.mjs` 和 `out/renderer/index.html` 已刷新。
- `git diff --check`：通过。

当前仍不代表用户人工验收完成；分支不应在用户验证前合入 `dev` 或 `main`。

## 2026-07-13 实机修复与合并交接

用户已在 macOS 实机连续验证并反馈问题，当前修复代码提交为
`2fdeb69d`（`fix(sideai): 完成贴边窗口实机修复`）。用户随后明确授权将当前状态合入并推送
`dev`，尚未解决的问题改在新对话、新分支继续，不再以“全部人工验收完成”作为本次合并前提。

本轮实机确认：

- 主程序可正常启动，贴边面板不会被放到屏幕外，面板内容不再透明或空白。
- macOS 进入贴边状态后 Dock 图标持续存在，点击 Dock 图标可从贴边尺寸恢复 `1200x800` 普通窗口。
- 设置窗口不再在开发/preview 模式自动打开独立 Developer Tools；系统窗口列表实测打开设置时只有
  `DeepChat` 和 `设置 - 设置概览`。
- 内嵌标签页同样取消自动打开 Developer Tools，`devTools: is.dev` 仍保留手动调试能力。

最终补充验证：

- `test/main/presenter/windowPresenter.test.ts`：13 项通过，包含设置窗口不自动打开 DevTools 回归。
- WindowFollower 主进程相关回归 50 项通过，相关 renderer 回归 128 项通过。
- `pnpm run format`、`pnpm run i18n`、`pnpm run lint`、`pnpm run typecheck`、`pnpm run build`
  和 `git diff --check` 均通过；build 仅有既有 chunk 警告。

交接时运行状态：

- 正式 worktree：
  `/Users/mac123/.config/superpowers/worktrees/SideAI-DeepChat/window-follower-integration`
- 功能分支：`sideai/window-follower-integration`
- 应用通过 `pnpm start` 启动，交接时 Electron PID 为 `31919`。
- `.superpowers/` 是未跟踪的本地过程目录，不纳入提交。

新对话优先处理：

1. 确认原 DeepChat 设置中是否已有中文界面切换，并修复当前英文界面的语言选择/持久化问题。
2. 继续逐项验收贴边、透明 reserve、工具栏、折叠、固定、脱吸附、历史浮层和真实聊天。
3. 继续确认 normal、panel、collapsed 的同一 `BrowserWindow` / `webContents.id` 实机证据。
4. 新修改应从已更新的 `origin/dev` 创建新分支，不继续向本次已合并功能分支追加问题修复。

### 合并完成状态

- 远端功能分支已推送至 `b9eb3b77`。
- 功能分支与 `origin/dev` 合并时仅 `src/types/i18n.d.ts` 出现冲突；保留了 `dev` 的
  `loadMore` 翻译类型后解决，业务代码无冲突。
- 合并提交为 `33eb739c`（`merge(sideai): 合入贴边窗口融合`），已推送到远端 `dev`。
- 合并结果再次通过 26 个相关测试文件、158 项测试，以及 `format:check`、`i18n`、`lint`、
  完整 `typecheck` 和生产构建。
