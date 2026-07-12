# WindowFollower 与 DeepChat 融合任务清单

## 基线与约束

- [x] 已在未修改的官方 v1.0.9 worktree 验证 format、i18n、lint、typecheck、build 和 dev 启动。
- [x] 已记录官方 baseline 的 3 个 Pinia 装配失败：`SpotlightOverlay.test.ts` 未激活 `useSidebarStore()`。
- [x] 已记录官方仓库没有 `pnpm-lock.yaml`，安装使用 `--lockfile=false`。
- [x] 已记录 `prebuild` 刷新三个生成资源文件。
- [x] 每项实现先写失败测试并观察失败，再写最小代码。

## Task 1：纯模块与共享 DTO

- [x] 建立 `src/shared/windowFollower.ts`，定义 `WindowFollowerMode`、`WindowContextSnapshot`、`WindowFollowerDebugDto` 和权限 DTO 的 zod/TypeScript 双重边界。
- [x] 迁移 deadline、目标鲜度和排除模块，补齐 stale/unavailable 与 SideAI 自身聚焦测试；窗口读取和同应用临时小窗由 Task 2 的 GetWindowsAdapter 完成。
- [x] 迁移二维多显示器 geometry，覆盖相邻显示器、无相邻显示器 reserve 和折叠原生窗口尺寸；更多多屏矩阵沿用 SideAI 153 项测试并在 presenter 阶段补齐。
- [x] 迁移模式、拖拽、折叠和透明鼠标策略，验证真实原生窗口尺寸与可见气泡一致。

## Task 2：权限、get-windows 与打包

- [x] 先写权限 TTL、显式刷新、系统设置导航和撤销降级失败测试。
- [x] 实现 macOS permission service；缺失权限时 WindowContextService 输出 `unavailable`，不读取旧目标。
- [x] 先写 GetWindowsAdapter 失败测试，再封装 `get-windows`，确保 renderer/Agent 不直接导入其类型。
- [x] 在 `electron-builder.yml` `asarUnpack` 增加 `**/node_modules/get-windows/**/*`，更新构建配置测试。

## Task 3：Presenter 与同一 BrowserWindow

- [x] 先写 presenter 的模式转换测试：普通 -> 自动跟随 -> 普通、固定、脱吸附、折叠、Dock/快捷键恢复和撤权降级。
- [x] 实现 `WindowFollowerPresenter`，只通过窗口适配器调用 `setBounds`、`setAlwaysOnTop`、`setIgnoreMouseEvents`、`showInactive` 和普通 `show`。
- [x] 在 `WindowPresenter` 创建/激活/快捷键路径中装配 presenter，确认 webContents ID 不变；设置入口随 Task 4 typed route 一并接入。
- [x] 验证普通大窗口状态单独持久化，进入贴边前 `unmanage()`，恢复普通边界后 `manage()`，贴边或屏幕外位置不写入 `electron-window-state`。

## Task 4：typed route/event/client 与调试页

- [x] 先为每个 route/event 写 schema 失败测试，覆盖未知字段拒绝和 event catalog 注册。
- [x] 注册 `windowFollower.routes.ts` 与 `windowFollower.events.ts`，从主路由 runtime 提供读取、模式、权限、重新读取和本地调试接口。
- [x] 新增 `WindowFollowerClient.ts`，renderer 禁止裸 IPC。
- [x] 新增调试覆盖层和永久 Bug 入口；typed event 实时更新，返回聊天保留已挂载会话/草稿，复制只写本地剪贴板不发给 AI。

## Task 5：发送前上下文门禁

- [x] 先写 chat route 测试：发送前权限复检失败时无 metadata，权限完整且自动跟随时捕获不可变快照。
- [x] 将可选 `windowContext` 放入 DeepChat 原有发送输入，不改变 `text/files/activeSkills/inlineItems`；首条 `sessions.create` 与后续 `chat.sendMessage` 均在主进程解析后捕获。
- [x] 对固定、脱吸附、普通、排除、stale 超时和 unavailable 清空旧上下文，并验证每条消息使用发送时快照。
- [x] 运行 Agent/工具/MCP/CLI/CUA 相关原生测试，确认 route 扩展不改变现有 payload（Task 5 定向回归 402 项通过）。

## Task 6：验证与交付

- [x] 执行 `pnpm run format`、`pnpm run i18n`、`pnpm run lint`、`pnpm run typecheck`、`pnpm test`、`pnpm run build`、`git diff --check`。静态检查和构建通过；全量测试 `467` 个文件通过、`11` 个跳过，剩余 `5` 项均在官方 v1.0.9 基线复现。
- [x] 重新运行 fork-relative 路线边界检查：不存在 `vendor/deepchat`，相对官方 v1.0.9 未新增 SideAI 自建 ChatStore、DeepSeek client/proxy、环境变量 Key 或旧 IPC。官方基线原本跟踪的 `.env.example` 和 DeepSeek Provider 保持不变，避免破坏 DeepChat 原生能力。
- [x] 记录已知官方 Pinia 三项失败与生成资源变化，不把基线问题伪装成融合回归。另有两个官方主进程既有断言失败；本次修复了新增的 ChatTabView Pinia 装配回归。构建更新 `resources/acp-registry/registry.json`、`resources/model-db/providers.json` 和 `src/renderer/src/lib/icons/icon-collections.generated.ts`。
- [x] 用中文 Conventional Commit 提交，推送 `sideai/window-follower-integration`，摘要和推送说明使用中文。
