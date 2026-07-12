# WindowFollower 与 DeepChat 融合实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在官方 DeepChat v1.0.9 中以最小边界融合已验收的 macOS WindowFollower，同时保留 DeepChat 全部原生聊天和 Agent 能力。

**Architecture:** 先迁移不依赖 UI 的 WindowFollower 纯模块，再由独立 `WindowFollowerPresenter` 通过 DeepChat typed routes/events/client 驱动 `WindowPresenter` 管理的同一个主窗口。窗口上下文在发送前经过权限复检并作为可选 metadata 进入原生聊天入口，调试页只消费本地 DTO。

**Tech Stack:** Electron 40、Vue 3、TypeScript、Pinia、Vitest、DeepChat Presenter/EventBus/typed contracts、`get-windows`。

---

## 文件地图

- Create: `src/main/windowFollower/`，迁移的纯模块、权限服务、窗口上下文和 presenter 适配器。
- Create: `src/shared/contracts/routes/windowFollower.routes.ts`、`src/shared/contracts/events/windowFollower.events.ts`、`src/shared/windowFollower.ts`，共享 DTO 和 zod schema。
- Create: `src/renderer/api/WindowFollowerClient.ts`、`src/renderer/src/views/windowFollower/`，typed client 和调试/贴边面板视图。
- Modify: `src/main/presenter/windowPresenter/index.ts`、`src/main/presenter/index.ts`、`src/main/routes/index.ts`、`src/main/routes/chat/chatService.ts`，装配同一 BrowserWindow、路由和发送前上下文门禁。
- Modify: `src/shared/contracts/routes/chat.routes.ts`、`src/shared/types/agent-interface.d.ts`、`src/shared/contracts/common.ts`，增加可选不可变窗口 metadata，不改变原有字段语义。
- Modify: `src/renderer/src/i18n/**`、主导航/聊天组件，保留 Bug 入口、权限入口、模型设置入口和草稿。
- Modify: `electron-builder.yml`、`test/main/build/electronBuilderConfig.test.ts`，解包 `get-windows`。
- Create: `test/main/windowFollower/**`、`test/renderer/windowFollower/**`、`test/main/routes/windowFollower.test.ts`，按模块和 contract 分层测试。
- Create: `docs/architecture/window-follower-integration/tasks.md`，执行勾选清单。

## 依赖顺序

1. 纯模块和共享 DTO。
2. 权限/get-windows/打包边界。
3. Presenter 与主窗口策略。
4. typed routes/events/client 和调试页。
5. 发送前窗口上下文门禁。
6. 原生聊天回归、完整验证和中文提交。

## 任务摘要

### Task 1：迁移纯模块并建立 contract 测试

从 SideAI 恢复分支逐个迁移 `activeWindowReader`、`timedSingleFlightReader`、`targetTracker`、`panelBounds`、`panelFollowDecision`、`panelMode`、`panelMousePassthrough`、`panelPresentationBounds`、`panelUpdateCoordinator`、应用排除和设置模块。保留注入时钟/屏幕列表接口，先写失败测试再实现。共享类型只放 DTO，不泄漏 `get-windows` 原生类型。

### Task 2：权限与 get-windows

新增 macOS 权限 service，提供 TTL 采样、显式强制刷新、系统设置 URL 和撤销降级。`GetWindowsAdapter` 是 `get-windows` 唯一调用点；非 macOS 返回明确 unavailable。将 `get-windows` 加入 `electron-builder.yml` 的 `asarUnpack`，补充配置测试。

### Task 3：WindowFollowerPresenter 与单窗口策略

新增 presenter，注入 `IWindowPresenter`/窗口适配器和 `screen` provider。首次创建显示 DeepChat 普通大窗口；权限完整并激活外部窗口时使用同一 BrowserWindow 切换贴边；通过 `showInactive()` 防止抢焦点。主窗口现有关闭、激活、快捷键、设置路径都调用取消贴边并恢复普通边界。为普通边界和贴边边界建立独立持久化键。

### Task 4：typed routes/events/client 与调试页

新增 window follower route/event schema、主路由注册、renderer client 和调试视图。事件推送使用 DeepChat event envelope；复制调试信息仅在本地生成。模式按钮、重新读取、权限设置、返回聊天和模型/API 设置均走 typed client。

### Task 5：窗口上下文与原生 Chat 入口

在 `chat.routes.ts` 和发送服务中增加可选 `windowContext` metadata。发送 handler 先强制检查权限，再从 presenter 获取当前不可变快照；固定/脱吸附/普通/排除/unavailable 均清空 metadata。为每条消息写 contract 测试，确认原有 `text/files/activeSkills/inlineItems` 和 DeepChat Agent 路径不变。

### Task 6：回归、文档和集成

执行 format/i18n/lint/typecheck/test/build；将官方 Pinia 三项失败、生成资源刷新和无 lockfile 写入验证记录。运行路线边界检查，确认没有 vendor、`.env.example`、SideAI 自建聊天符号。完成后以中文 Conventional Commit 提交并推送 `sideai/window-follower-integration`，不修改官方 `dev` 的原生能力。

## 验证命令

```bash
pnpm run format:check
pnpm run i18n
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
git diff --check
test ! -e vendor/deepchat
test ! -e .env.example
! rg -n "ChatStore|DeepSeek|SIDEAI_PROXY|DEEPSEEK_API_KEY|chat:send-message" src test package.json
```

完整实现仍需遵循每项任务的 TDD 红/绿/重构循环；任何新 route 或 presenter 行为必须先有失败测试。
