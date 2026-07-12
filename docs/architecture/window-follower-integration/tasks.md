# WindowFollower 与 DeepChat 融合任务清单

## 基线与约束

- [x] 已在未修改的官方 v1.0.9 worktree 验证 format、i18n、lint、typecheck、build 和 dev 启动。
- [x] 已记录官方 baseline 的 3 个 Pinia 装配失败：`SpotlightOverlay.test.ts` 未激活 `useSidebarStore()`。
- [x] 已记录官方仓库没有 `pnpm-lock.yaml`，安装使用 `--lockfile=false`。
- [x] 已记录 `prebuild` 刷新三个生成资源文件。
- [ ] 每项实现先写失败测试并观察失败，再写最小代码。

## Task 1：纯模块与共享 DTO

- [x] 建立 `src/shared/windowFollower.ts`，定义 `WindowFollowerMode`、`WindowContextSnapshot`、`WindowFollowerDebugDto` 和权限 DTO 的 zod/TypeScript 双重边界。
- [x] 迁移 deadline、目标鲜度和排除模块，补齐 stale/unavailable 与 SideAI 自身聚焦测试；窗口读取和同应用临时小窗由 Task 2 的 GetWindowsAdapter 完成。
- [x] 迁移二维多显示器 geometry，覆盖相邻显示器、无相邻显示器 reserve 和折叠原生窗口尺寸；更多多屏矩阵沿用 SideAI 153 项测试并在 presenter 阶段补齐。
- [x] 迁移模式、拖拽、折叠和透明鼠标策略，验证真实原生窗口尺寸与可见气泡一致。

## Task 2：权限、get-windows 与打包

- [ ] 先写权限 TTL、显式刷新、系统设置导航和撤销降级失败测试。
- [ ] 实现 macOS permission service；缺失权限时 WindowContextService 输出 `unavailable`，不读取旧目标。
- [ ] 先写 GetWindowsAdapter 失败测试，再封装 `get-windows`，确保 renderer/Agent 不直接导入其类型。
- [ ] 在 `electron-builder.yml` `asarUnpack` 增加 `**/node_modules/get-windows/**/*`，更新构建配置测试。

## Task 3：Presenter 与同一 BrowserWindow

- [ ] 先写 presenter 的模式转换测试：普通 -> 自动跟随 -> 普通、固定、脱吸附、折叠、隐藏/恢复和窗口销毁。
- [ ] 实现 `WindowFollowerPresenter`，只通过窗口适配器调用 `setBounds`、`setAlwaysOnTop`、`setIgnoreMouseEvents`、`showInactive` 和普通 `show`。
- [ ] 在 `WindowPresenter` 创建/激活/快捷键/设置路径中装配 presenter，确认 webContents ID 不变。
- [ ] 验证普通大窗口状态单独持久化，贴边或屏幕外位置不写入 `electron-window-state`。

## Task 4：typed route/event/client 与调试页

- [ ] 先为每个 route/event 写 schema 失败测试，覆盖未知字段拒绝和事件 envelope。
- [ ] 注册 `windowFollower.routes.ts` 与 `windowFollower.events.ts`，从主路由 runtime 提供读取、模式、权限、重新读取和调试复制接口。
- [ ] 新增 `WindowFollowerClient.ts`，renderer 禁止裸 IPC。
- [ ] 新增调试页和贴边顶部入口；验证切换目标实时更新、返回聊天保留会话/草稿、复制不发给 AI。

## Task 5：发送前上下文门禁

- [ ] 先写 chat route 测试：发送前权限复检失败时无 metadata，权限完整且自动跟随时捕获不可变快照。
- [ ] 将可选 `windowContext` 放入 DeepChat 原有发送输入，不改变 `text/files/activeSkills/inlineItems`。
- [ ] 对固定、脱吸附、普通、排除、stale 超时和 unavailable 清空旧上下文，并验证每条消息使用发送时快照。
- [ ] 运行 Agent/工具/MCP/CLI/CUA 相关原生测试，确认 route 扩展不改变现有 payload。

## Task 6：验证与交付

- [ ] 执行 `pnpm run format`、`pnpm run i18n`、`pnpm run lint`、`pnpm run typecheck`、`pnpm test`、`pnpm run build`、`git diff --check`。
- [ ] 重新运行路线边界检查，确认不存在 `vendor/deepchat`、`.env.example`、SideAI 自建聊天符号。
- [ ] 记录已知官方 Pinia 三项失败与生成资源变化，不把基线问题伪装成融合回归。
- [ ] 用中文 Conventional Commit 提交，推送 `sideai/window-follower-integration`，摘要和推送说明使用中文。
