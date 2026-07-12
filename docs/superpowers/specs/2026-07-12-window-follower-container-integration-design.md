# WindowFollower 容器完整融合设计

状态：用户已确认，2026-07-12

## 背景与根因

当前分支已迁入 WindowFollower 的主进程几何、权限、窗口读取、模式和消息上下文能力，但没有完整迁入旧 SideAI renderer 容器。实际运行暴露出四类阻断问题：

1. DeepChat 普通窗口默认 `800x620`，不足以承载完整桌面布局，首次引导和主内容发生裁切。
2. 贴边时仍渲染完整桌面侧栏和欢迎页，没有切换为单列窄布局。
3. 主进程会在屏幕右边缘生成 `contentOffsetX=44` 的透明 reserve，但 DeepChat 根容器没有消费该偏移，导致本应透明的区域渲染成白色内容并覆盖目标窗口。
4. 旧 SideAI 的折叠、固定、脱吸附、拖动、宽度重置、设置、隐藏和退出只迁入了部分底层 route，没有形成可用的贴边容器控制面。

因此，本次修复不是重新实现 WindowFollower，而是补齐“主进程容器策略 -> typed state -> DeepChat renderer 根布局 -> 用户控制”的闭环。旧 SideAI 已验收的贴边容器是实现基准，不重新设计其几何、模式或交互语义。

## 目标

- 普通模式使用完整 DeepChat 桌面布局，默认窗口尺寸足以显示侧栏、主内容和首次引导。
- 贴边模式继续使用同一个 `BrowserWindow`、同一个 renderer、同一份 Pinia store 和会话状态，不 reload、不创建第二套聊天页面。
- 贴边 renderer 正确消费 `contentOffsetX`，透明 reserve 不渲染内容、不覆盖目标窗口，并保持旧 SideAI 的鼠标穿透行为。
- 贴边界面只重排 DeepChat 已有能力，不复制 Tabbit 的聊天、建议词、上下文采集或工具能力。
- 恢复旧 SideAI 容器控制，并采用用户确认的横向展开工具条结构。

## 普通窗口

普通模式保持 DeepChat 原版桌面结构：`AppBar`、`WindowSideBar`、路由内容和 side panel 均保留。主窗口使用适合桌面布局的默认边界，并在读取历史持久化边界时保证宽高不低于桌面布局的最低可用尺寸。WindowFollower 进入贴边前继续暂停 `electron-window-state`，恢复普通模式后恢复正常边界和状态跟踪，贴边边界不得污染普通窗口持久化状态。

预览/dev 启动不自动打开独立 DevTools 窗口；DevTools 仍可通过原有菜单或快捷键手动打开。

## 贴边根容器与透明 reserve

renderer 新增单一的 WindowFollower UI state store，通过 `WindowFollowerClient.getState()` 初始化，并订阅 `windowFollower.stateChanged`。store 保存至少以下可观察状态：

- `mode`
- `collapsed`
- `panelWidth`
- `contentOffsetX`
- `placement`
- 当前窗口上下文摘要与权限状态

DeepChat 根容器只在非 `normal` 模式进入 panel surface：

- 根层宽度为 `calc(100vw - contentOffsetX)`。
- 根层沿 X 轴平移 `contentOffsetX`。
- reserve 本身保持透明，不挂载内容。
- renderer 根据指针是否进入真实内容区域调用 typed `setPointerInteractive`，复用旧 SideAI 的透明 reserve 鼠标穿透策略。
- `contentOffsetX=0` 时不产生额外平移，多显示器右侧有真实显示器时保持原有跨屏放置。

## 贴边布局

贴边时隐藏 DeepChat 桌面侧栏和不适合窄宽度的桌面装饰，但继续复用以下原组件和数据：

- `ChatPage`、`MessageList`、消息动作与流式输出
- `NewThreadPage` 的 DeepChat 草稿、Agent、Provider、模型和工作区逻辑
- `ChatInputBox`、附件、mention、技能、MCP、工具和发送路径
- DeepChat 原有会话 store、会话选择、分组与分页

首次引导、Provider 设置提示、对话框和 popover 在 panel surface 下使用单列且受 viewport 约束的布局，不允许固定桌面宽度溢出。

贴边内容顶部不显示“当前 DeepChat 会话”标题，不模拟 macOS 红绿灯、关闭或最小化栏。

## 容器工具条

贴边窗口第一行属于 WindowFollower 容器，不属于聊天。旧 SideAI 的按钮和能力全部保留，只给“按钮组”增加收起/展开的显示状态：

- 默认收起按钮组，但全部原有功能仍存在；顶部保留按钮组开关，其余区域为可拖动区。
- 点击按钮组开关后，全部原有按钮沿水平方向展开；再次点击可收回按钮组。
- 原有按钮包括：收起为气泡、固定/取消固定、脱吸附/恢复吸附、重置宽度、更多/WindowFollower 设置、隐藏和退出，一个都不能删除或改义。
- 固定与脱吸附为持续状态，按钮保持可辨识的选中态；两者继续互斥。
- “展开/收起按钮组”与“收起为气泡”是两个独立动作；前者只改变工具栏展示，后者继续调用旧 SideAI 的原生窗口折叠行为。
- 折叠为气泡后只显示旧 SideAI 式展开命中区；展开恢复原位置和面板宽度。

固定和脱吸附模式直接复用旧 SideAI 的 stationary 行为：允许拖动，折叠后在拖动位置原地展开，用户移动不能被下一次 follow poll 立即覆盖。跟随模式的程序化移动与用户移动继续通过 `panelPresentationBounds` / update coordinator 区分。迁移时以旧 SideAI recovery worktree 的实现和测试为参考，不用简化版 Presenter 重新推导这些行为。

## DeepChat 会话操作

DeepChat 的会话操作位于聊天内容右上角，与容器工具条分开：

- 新对话：当前已有正式会话时显示；当前是尚未发送的空白新对话时隐藏。
- 历史：始终显示。点击后打开覆盖消息区的浮层，不永久占用贴边宽度。
- 恢复大窗口：始终显示，调用 WindowFollower `normal` 模式，恢复同一个 `BrowserWindow`。

历史浮层复用 DeepChat 现有 session store、项目/聊天分组、分页和会话切换；不建立 Tabbit 数据层。再次点击历史按钮、选择会话、点击浮层外部或按 Escape 时关闭。

## 设置与能力边界

WindowFollower 设置包含本阶段已有的权限检测、自动贴边开关、宽度控制和调试状态。旧 SideAI 已迁入但尚未装配的排除应用能力，仅在现有主进程模块能够通过 typed route 完整接通时恢复；不得引入裸 IPC。

聊天、Provider、自定义 Key、Agent、CLI、MCP、技能、工具和 CUA 全部继续由 DeepChat 提供。WindowFollower 只控制容器状态和发送前可信窗口上下文，不复制 Tabbit 或旧 SideAI 的聊天实现。

## 错误与降级

- 权限缺失或撤销：立即返回普通 DeepChat 桌面窗口，停止发送窗口上下文。
- 窗口读取失败：聊天继续可用；跟随状态按既有 stale/unavailable 策略降级。
- renderer 状态初始化失败：默认按普通 DeepChat 布局渲染，不能以错误的 panel surface 覆盖目标窗口。
- panel 控制 route 失败：恢复上一份可观察状态，并给出本地错误提示，不改变聊天消息。

## 测试与验收

实现严格使用 TDD，至少覆盖：

1. 普通窗口默认/恢复边界满足桌面最低尺寸，且预览启动不自动打开 DevTools。
2. `WindowFollowerDebugDto` 完整传输 `collapsed`、`panelWidth` 和 `contentOffsetX`，未知字段仍被 schema 拒绝。
3. panel surface 根容器应用 `width = viewport - contentOffsetX` 与 X 平移；`contentOffsetX=0` 时不平移。
4. reserve 与真实内容区域的鼠标交互切换正确。
5. 普通模式显示桌面侧栏；贴边模式隐藏侧栏并保留 DeepChat 聊天/新对话组件。
6. 空白新对话隐藏新建按钮，正式会话显示；历史浮层打开、关闭、分页和选择会话正确。
7. 容器工具条默认收起、横向展开、执行动作后收回；固定/脱吸附状态正确。
8. 折叠气泡、原地展开、固定/脱吸附拖动、宽度调整和重置与旧 SideAI 行为一致。
9. 右边缘单显示器、多显示器相邻、负坐标显示器和目标窗口跨屏场景不覆盖目标窗口内容。
10. 同一个 `webContents.id` 在普通窗口、跟随、固定、脱吸附和折叠之间保持不变。

完成后运行定向测试、完整 format/i18n/lint/typecheck/test/build、路线边界和 Electron 人工验证。人工验证必须包含普通窗口、右边缘 reserve、多显示器、工具条、折叠/固定/脱吸附、历史浮层和真实聊天发送；未完成该验证前不得晋升 `main`。
