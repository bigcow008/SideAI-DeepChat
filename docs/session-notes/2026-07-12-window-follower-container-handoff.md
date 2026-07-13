# WindowFollower 容器完整融合交接

日期：2026-07-12

## 恢复入口

正式工作区：

```text
/Users/mac123/.config/superpowers/worktrees/SideAI-DeepChat/window-follower-integration
```

分支：`sideai/window-follower-integration`

当前本地 HEAD：`d097ccbeacecbc039b0b45c2307c8eb489c371fb`

当前远端 `origin/sideai/window-follower-integration`：`ecfaff19b6c08b9958860c9851c0ebe49f53361c`

本地领先远端 1 个中文设计提交：

```text
d097ccbe docs(sideai): 补充贴边容器完整融合设计
```

不要在 `/Users/mac123/dev/SideAI` 的脏 `main` 上开发，不要清理或覆盖该目录。该旧仓库只作为历史/原型证据；正式实现必须留在 DeepChat fork worktree。

## 新发现：当前分支不能晋升 main

用户实际打开 Electron 后发现当前融合不可用：

1. preview/dev 启动自动打开独立 DevTools，表现为两个窗口。
2. DeepChat 主窗口默认 `800x620`，完整桌面布局和首次引导被裁切。
3. 进入贴边后仍渲染完整桌面侧栏/欢迎页，窄面板严重溢出。
4. 目标窗口靠屏幕右边缘时，贴边窗口有一条白色内容区域压住目标窗口。
5. 旧 SideAI 已验收的折叠、固定、脱吸附、拖动、宽度重置、设置、隐藏、退出等容器能力没有形成可用 UI。

此前 Task 6 的“交付完成”结论已被真实人工验证推翻。不得创建 PR、fast-forward `main` 或宣称可用，直到本交接的完整验收通过。

## 用户最终确认的产品要求

这是最高优先级边界：

- **之前 SideAI 已调试好的贴边容器底座不要改。**
- 直接复用旧 SideAI 容器的几何、透明 reserve、鼠标穿透、多显示器、跟随、固定、脱吸附、拖动、宽度、折叠气泡、原地展开、隐藏、退出和设置行为。
- 旧 SideAI 容器原有按钮全部保留，一个都不能删除或改义。
- 顶部按钮组需要能够横向收起/展开，以释放拖动区域；这只是按钮组的展示折叠，不是删除按钮。
- “展开/收起按钮组”和“把整个面板收成小气泡”是两个独立动作。
- 顶部不要显示“当前 DeepChat 会话”，不要模拟 macOS 关闭/最小化/红绿灯栏。
- 容器顶部按旧 SideAI，DeepChat 只作为容器内部内容层。
- 聊天、Provider、自定义 Key、Agent、CLI、MCP、技能、工具和 CUA 全部复用 DeepChat，不复制 Tabbit 或旧 SideAI 聊天实现。
- Tabbit 只作为按钮位置/空间组织参考，不复制其功能。
- DeepChat 新对话按钮：当前已有正式会话时显示；当前是未发送的空白新对话时隐藏。
- DeepChat 历史按钮：放在内容区右上角；点击后以浮层显示 DeepChat 现有历史会话，不能把历史列表永久放在贴边面板中。
- 历史浮层必须复用 DeepChat session store、分组、分页和切换逻辑。
- 恢复大窗口按钮：恢复同一个 `BrowserWindow` 到普通 DeepChat 桌面布局。
- 普通窗口必须完整可用，默认尺寸不能裁切桌面布局或首次引导。

## 已确认根因

### 白色区域覆盖目标窗口

这是透明 reserve 的 renderer 映射缺失，不是 `panelBounds` 算法本身错误。

旧 SideAI 在目标窗口靠屏幕右边缘且右侧没有显示器时：

1. 主进程将原生窗口向左扩 `RIGHT_EDGE_VISIBLE_RESERVE=44`。
2. DTO 发出 `contentOffsetX=44`。
3. renderer 根容器使用：

```css
width: calc(100vw - var(--content-offset-x));
transform: translateX(var(--content-offset-x));
```

4. 左侧 44px 保持透明，并根据真实内容命中调用鼠标穿透。

当前 DeepChat 已完成步骤 1/2，但根容器完全没有消费 `contentOffsetX`，所以 reserve 被渲染为白色 DeepChat 内容并覆盖目标窗口。证据：

```text
/Users/mac123/.config/superpowers/worktrees/SideAI/window-follower-recovery/src/renderer/App.tsx
/Users/mac123/.config/superpowers/worktrees/SideAI/window-follower-recovery/src/renderer/styles.css
src/main/windowFollower/core/panelBounds.ts
src/main/presenter/windowFollowerPresenter/index.ts
```

### 容器能力缺失

旧 SideAI renderer 容器被错误地当作“可舍弃外壳”，只迁入了简化 Presenter、typed route 和调试页。`WindowFollowerClient` 已有 `setMode`、`setCollapsed`、`setWidth`、`setPointerInteractive` 等调用，但普通 DeepChat renderer 没有容器 store/toolbar 消费它们。

当前简化 Presenter 也没有完整装配旧 SideAI 的：

- stationary expanded bounds
- 原生 move 协调
- 跟随时程序化移动与用户移动区分
- 宽度拖拽/重置
- 折叠后原地展开
- 排除当前应用 UI
- 完整容器状态 DTO

### 两个窗口

`src/main/presenter/windowPresenter/index.ts` 在 `is.dev` 时自动 `openDevTools({ mode: 'detach' })`，preview 环境因此出现独立 DevTools。用户不接受默认两个窗口；预览/开发启动不应自动打开 DevTools，仍可手动打开。

### 普通窗口裁切

`createManagedWindow()` 默认 `800x620`，但 DeepChat 桌面布局实际需要更大尺寸。还需验证并规范持久化边界的最低可用宽高，避免历史小尺寸再次恢复。

## 正式设计

已确认并提交：

```text
docs/superpowers/specs/2026-07-12-window-follower-container-integration-design.md
```

新对话必须先完整读取该文件，再写实施计划。若计划与“旧 SideAI 容器底座不要改”冲突，以用户要求和本交接为准。

## 旧 SideAI 容器参考（必须读取）

正式参考 worktree：

```text
/Users/mac123/.config/superpowers/worktrees/SideAI/window-follower-recovery
```

至少完整读取：

```text
src/renderer/App.tsx
src/renderer/styles.css
src/main/main.ts
src/main/panelBounds.ts
src/main/panelPresentationBounds.ts
src/main/panelMousePassthrough.ts
src/main/panelMode.ts
src/main/panelUpdateCoordinator.ts
src/shared/types.ts
```

旧版工具栏原有顺序和动作可在 `src/renderer/App.tsx` 的 `.actions` nav 找到：收起为气泡、固定、脱吸附、重置宽度、更多/设置、拖动区、隐藏、退出。新实现保留全部能力，只给按钮组增加横向收起/展开状态。

不要从 `/Users/mac123/dev/SideAI` 的脏文件复制自建聊天、DeepSeek、proxy、环境变量或 vendor DeepChat。

## 当前 DeepChat 关键文件

```text
src/main/presenter/windowPresenter/index.ts
src/main/presenter/windowFollowerPresenter/index.ts
src/main/windowFollower/core/*
src/shared/windowFollower.ts
src/shared/contracts/routes/windowFollower.routes.ts
src/shared/contracts/events/windowFollower.events.ts
src/main/routes/windowFollowerRoutes.ts
src/renderer/api/WindowFollowerClient.ts
src/renderer/src/App.vue
src/renderer/src/views/ChatTabView.vue
src/renderer/src/components/WindowSideBar.vue
src/renderer/src/components/windowFollower/WindowFollowerDebugView.vue
src/renderer/src/pages/ChatPage.vue
src/renderer/src/pages/NewThreadPage.vue
src/renderer/src/stores/ui/session.ts
```

## 下一步执行顺序（TDD）

新对话先使用 `superpowers:writing-plans`，把计划写到：

```text
docs/superpowers/plans/2026-07-12-window-follower-container-integration.md
```

然后使用 `superpowers:executing-plans` inline 执行，不需要再次脑暴。建议任务顺序：

1. **普通窗口与 DevTools**：失败测试覆盖合理默认/最低尺寸和不自动打开 DevTools；最小修复。
2. **完整 DTO/store**：失败 contract/store 测试覆盖 `collapsed`、`panelWidth`、`contentOffsetX`、mode 和初始化失败降级。
3. **透明 reserve 根布局**：失败 renderer 测试证明 `contentOffsetX=44` 时内容宽度减 44 并平移，0 时不平移；恢复真实内容/透明区鼠标命中。
4. **旧 SideAI Presenter 容器行为**：以 recovery 测试矩阵补齐 move coordinator、stationary bounds、折叠原地展开、宽度、固定/脱吸附和同一 webContents。
5. **SideAI 容器工具栏**：全部旧按钮 + 按钮组横向收起/展开；默认最大拖动区。
6. **DeepChat 窄布局**：同一组件响应式重排；隐藏桌面侧栏；保持 ChatPage/NewThreadPage/ChatInputBox 原逻辑。
7. **会话按钮与历史浮层**：空白新对话隐藏新建；正式会话显示；历史浮层复用 session store 和分页。
8. **弹窗/首次引导窄屏约束**：禁止 panel surface 溢出。
9. **完整验证与真实人工验收**。

任何生产代码修改前必须先观察对应失败测试；不要为了赶进度先写实现。

## 验收门槛

必须由用户实际打开程序验证，不能只看 `renderer ready`：

- 普通窗口只出现一个应用窗口，布局完整，无裁切。
- 右边缘 reserve 不覆盖目标窗口；透明区域鼠标可穿透。
- 有右侧显示器时面板正确进入相邻显示器，不产生假 reserve。
- 负坐标/上下排列/跨屏场景正常。
- 顶部是旧 SideAI 容器，不显示当前会话标题或 macOS 模拟栏。
- 按钮组能横向收起/展开，全部旧按钮存在且功能正确。
- 折叠气泡、原地展开、固定、脱吸附、拖动、宽度重置、设置、隐藏、退出正常。
- DeepChat 新对话、历史浮层、会话切换正常。
- DeepChat Provider、Agent、附件、MCP、工具和真实聊天发送正常。
- 普通/贴边切换始终保持同一个 `BrowserWindow` / `webContents.id`，不 reload、不丢草稿、不打断流式任务。

在用户明确验收前，不得勾选交付完成、不得晋升 `main`。

## 测试基线

前一轮 Node `24.14.1` 验证：format、i18n、lint、typecheck、build 通过。全量测试为 `4588` 通过、`145` 跳过、`5` 失败；这 5 项已在未修改官方 v1.0.9 复现：

- `SpotlightOverlay.test.ts` 3 个 Pinia 装配失败。
- `agentSessionPresenter/integration.test.ts` 1 个 rebudget 断言失败。
- `createMockChatSession.test.ts` 1 个 plan block 断言失败。

新实现不得新增失败。使用本机 Node：

```bash
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH"
```

## 当前进程与本地草图

本对话启动过 Electron preview 和可视化草图服务。新对话开始时先检查/终止遗留进程，再重新启动需要的服务。

`.superpowers/` 是未跟踪的本地布局草图目录，只用于本轮视觉沟通。不要提交它；实施前可以删除或保持未跟踪，但不得让它进入 Git 提交。

## Git 与语言要求

- 所有 Git 提交、推送说明和用户摘要使用中文。
- 不强推。
- 保持旧 `/Users/mac123/dev/SideAI` 脏 main 原样。
- 当前本地设计提交尚未推送；交接记录提交后可非强制推送当前分支，或在首个实现提交前一起推送。
- 推送前必须检查 `git diff --check`、工作树和远端 SHA。
