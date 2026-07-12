# WindowFollower 与 DeepChat 融合规范

状态：设计确认，基于 SideAI 2026-07-12 验收交接记录

## 目标

在官方 DeepChat v1.0.9（`18820651410e3d4407c3e5be4e693f19de6cc030`）上融合已验收的 macOS WindowFollower。大窗口与贴边面板必须使用同一个 `BrowserWindow`、同一个 renderer 和同一份会话状态；切换不能销毁窗口、reload renderer 或中断流式任务。

## 范围

本阶段只迁移以下能力：

- WindowFollower 纯模块：窗口读取、目标鲜度、应用排除、模式状态、多显示器几何、鼠标穿透和更新协调。
- macOS 辅助功能/屏幕录制权限读取、TTL 采样、系统设置导航和权限状态 DTO。
- `get-windows` 作为唯一窗口读取来源，并在打包配置中加入 `asarUnpack`。
- 独立 `WindowFollowerPresenter`、typed routes/events、renderer client 和调试页。
- 发送消息前的权限复检与不可变窗口上下文捕获。

以下能力全部直接复用 DeepChat，不新建 SideAI 实现：聊天、会话历史、Provider、模型、自定义 Key/BYOK、Agent loop、CLI、MCP、工具和 CUA。WindowFollower 不直接调用聊天 runtime，也不添加散落裸 IPC。

## 架构边界

### 主窗口

`WindowPresenter` 继续拥有 DeepChat 主 `BrowserWindow`。`WindowFollowerPresenter` 只接收窗口策略请求并调用一个注入的窗口适配器：

- 普通模式使用 `electron-window-state` 保存的大窗口边界。
- 自动跟随使用 `showInactive()`、透明窗口和 `panelBounds` 计算结果，不抢目标应用焦点。
- 固定前端停止跟随、允许拖动并置顶；脱吸附停止跟随、允许拖动但不置顶。
- Dock/程序图标、全局主快捷键和设置入口都先取消贴边，再显示同一个大窗口。
- 普通窗口边界与贴边/屏幕外坐标分开保存，贴边位置不能污染下次大窗口启动位置。

### 数据流

`get-windows` -> `GetWindowsAdapter` -> `WindowContextService` -> `WindowFollowerPresenter` / 调试 DTO；renderer 仅通过 DeepChat typed route/client 读取状态和发出模式、权限、重新读取、复制调试信息请求。

每次发送消息时，`WindowFollowerPresenter` 先强制刷新权限；权限完整且当前模式为自动跟随时，创建不可变窗口上下文快照，向 DeepChat 原有 `chat:send-message` 的输入增加可选的 SideAI metadata。固定、脱吸附、普通、排除应用或上下文不可用时不携带旧目标。

### typed contracts

新增 route 文件放在 `src/shared/contracts/routes/windowFollower.routes.ts`，新增 event 文件放在 `src/shared/contracts/events/windowFollower.events.ts`，由 `src/main/routes/index.ts` 注册，并在 `src/renderer/api/WindowFollowerClient.ts` 暴露。不得从 renderer 直接使用 `ipcRenderer.invoke` 或硬编码 channel。

### 调试页

调试页是 DeepChat renderer 内的独立视图，不依赖模型或 Key，显示：模式、鲜度、应用稳定身份、窗口/进程 ID、标题、边界、显示器、贴边位置、越界状态、权限、采样/更新时间和最近错误。打开调试页不自动向 AI 发送窗口信息。

## 权限与降级

- macOS 两项权限齐全且自动贴边偏好开启时，后台 TTL 为 1 秒；授权后无需再次点击开关即可自动跟随。
- 权限缺失或撤销时回到普通 DeepChat，停止窗口读取和窗口上下文，并保留“打开设置/重新检测”入口。
- 显式重新检测或打开设置立即强制采样；其他 TCC 变化最多在下一个 1 秒采样周期生效。
- `get-windows` 失败时保留短暂 stale 位置，超过宽限期进入 unavailable，不把旧目标伪装成实时。

## 基线事实与验证约束

本规范基于未修改的官方 v1.0.9 baseline：

- 官方仓库没有 `pnpm-lock.yaml`，baseline 使用 `pnpm install --no-frozen-lockfile --lockfile=false`。
- `format:check`、i18n、lint、typecheck、build 和 Electron dev 启动均通过。
- 全量测试有 3 个官方上游 Pinia 装配失败：`test/renderer/components/SpotlightOverlay.test.ts` 调用了未激活的 `useSidebarStore()`；当前官方 `dev` 也存在同样问题，本融合不把它误报为回归。
- `prebuild` 会刷新 `resources/acp-registry/registry.json`、`resources/model-db/providers.json` 和 `src/renderer/src/lib/icons/icon-collections.generated.ts`；实现和验证必须记录这些生成资源变化。

## 非目标与安全边界

不迁入 SideAI 原型的 `vendor/deepchat`、自建 ChatStore、DeepSeek client/proxy、环境变量 Key 或固定模型表。不实现桌面操作、不自动采集 URL/选中文字/截图；未来操作能力继续复用 DeepChat Agent/tool/CUA 并单独设计授权与确认。DeepChat v1.0.9 的明文 Key 存储风险保持为公开发布前阻断项，本阶段不重写 Provider 存储。

## 验收

- WindowFollower 纯模块和 Presenter 单测覆盖模式转换、权限、鲜度、排除、多屏几何、鼠标穿透和单窗口切换。
- route/event contract 测试确认 typed payload 可序列化并拒绝未知字段。
- Chat route 回归确认原生聊天、Provider、Agent、CLI、MCP、工具和 CUA 行为不变。
- `pnpm run format:check`、`pnpm run i18n`、`pnpm run lint`、`pnpm run typecheck`、`pnpm test`、`pnpm run build` 通过；已知上游 Pinia 三项失败单独记录，不新增失败。
- 构建配置测试确认 `get-windows` 在 `asarUnpack`，且不存在 `vendor/deepchat`、`.env.example` 或 SideAI 自建聊天符号。
