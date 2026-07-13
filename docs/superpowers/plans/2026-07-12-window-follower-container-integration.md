# WindowFollower 容器完整融合实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改动旧 SideAI 已验收贴边容器语义的前提下，让同一个 DeepChat `BrowserWindow` 在完整桌面窗口、贴边面板和折叠气泡之间无 reload 切换，并在窄布局中继续使用 DeepChat 原生聊天、会话、Provider、Agent、CLI、MCP、技能、工具和 CUA。

**Architecture:** `WindowPresenter` 仍然独占主 `BrowserWindow`，`WindowFollowerPresenter` 直接装配旧 SideAI 的几何、stationary bounds、原生 move 协调、透明 reserve 和鼠标穿透策略。typed DTO/event 进入单一 Pinia store，renderer 用一个始终挂载的 surface 在桌面布局与贴边布局间重排；容器工具栏只控制原生窗口，历史浮层只消费 DeepChat 现有 session store。

**Tech Stack:** Electron 40、Vue 3 Composition API、TypeScript、Pinia、Vitest、Vue Test Utils、DeepChat typed bridge、Iconify `lucide:*` 图标、Tailwind CSS。

---

## 不可变兼容边界

- 旧 SideAI recovery worktree 是容器行为的实现基准：`/Users/mac123/.config/superpowers/worktrees/SideAI/window-follower-recovery`。
- 不修改 `panelBounds` 的已验收几何常量和多显示器判断；新增代码只把已有结果完整装配到 Presenter 和 renderer。
- 同一个 `BrowserWindow` / `webContents.id` 在 `normal`、`following`、`fixed`、`detached`、collapsed 之间保持不变。
- renderer 不使用裸 IPC；所有控制通过 `src/shared/contracts/routes/windowFollower.routes.ts` 和 `WindowFollowerClient`。
- Tabbit 只作为按钮位置和空间结构参考，不迁入其聊天或数据逻辑。
- `.superpowers/` 保持未跟踪，不加入任何提交。
- 自动验证之后只进入“等待用户人工验收”状态；不得创建 PR、晋升 `main` 或宣称交付完成。

## 文件地图

### 主进程窗口与容器

- Create: `src/main/presenter/windowPresenter/managedWindowBounds.ts`，定义桌面窗口默认/最低尺寸和持久化边界归一化。
- Modify: `src/main/presenter/windowPresenter/index.ts`，使用归一化桌面边界、移除自动 DevTools、切换 panel chrome，并继续管理同一主窗口。
- Modify: `src/main/presenter/windowFollowerPresenter/index.ts`，装配旧 SideAI stationary bounds、native move、update coordinator、折叠、宽度、shadow 和透明 reserve 行为。
- Modify: `src/main/presenter/index.ts`，注入窗口 chrome、隐藏、退出、宽度持久化和排除应用依赖。
- Modify: `src/main/windowFollower/windowContextService.ts`，装配排除应用状态和持久化操作。
- Reuse unchanged: `src/main/windowFollower/core/panelBounds.ts`、`panelPresentationBounds.ts`、`panelMousePassthrough.ts`、`panelMode.ts`、`panelUpdateCoordinator.ts`。

### typed contract 与 renderer state

- Modify: `src/shared/windowFollower.ts`，补齐 panel state/settings DTO。
- Modify: `src/shared/contracts/routes/windowFollower.routes.ts`、`src/main/routes/windowFollowerRoutes.ts`，补齐 reset、settings、exclude、hide、quit typed commands。
- Modify: `src/renderer/api/WindowFollowerClient.ts`，为所有 state/settings 命令提供强类型返回值。
- Create: `src/renderer/src/stores/windowFollower.ts`，提供唯一 WindowFollower UI state、订阅、初始化降级和命令失败回滚。
- Modify: `src/renderer/src/stores/windowFollowerDebug.ts`、`src/renderer/src/components/windowFollower/WindowFollowerDebugView.vue`，调试覆盖层复用同一 state store。

### renderer 容器与窄布局

- Create: `src/renderer/src/components/windowFollower/WindowFollowerSurface.vue`，保持 RouterView 挂载并映射 `contentOffsetX`。
- Create: `src/renderer/src/components/windowFollower/WindowFollowerToolbar.vue`，保留旧 SideAI 全部按钮并增加独立的横向按钮组开关。
- Create: `src/renderer/src/components/windowFollower/WindowFollowerCollapsedBubble.vue`，复用 36px 原地展开命中区。
- Create: `src/renderer/src/components/windowFollower/WindowFollowerResizeHandle.vue`，复用旧 SideAI 宽度拖动节流。
- Create: `src/renderer/src/components/windowFollower/WindowFollowerSettingsPanel.vue`，承载自动贴边、宽度、权限、排除列表和调试入口。
- Create: `src/renderer/src/components/windowFollower/WindowFollowerSessionControls.vue`，承载新对话、历史和恢复大窗口。
- Create: `src/renderer/src/components/windowFollower/WindowFollowerHistoryOverlay.vue`，消费 session store 的分组、分页和切换。
- Modify: `src/renderer/src/App.vue`、`src/renderer/src/assets/style.css`，在同一组件树中切换 desktop/panel surface，保持 body/reserve 透明。
- Modify: `src/renderer/src/views/ChatTabView.vue`、`src/renderer/src/pages/ChatPage.vue`、`src/renderer/src/pages/NewThreadPage.vue`、`src/renderer/src/pages/WelcomePage.vue`，提供单列窄布局。
- Modify: `src/renderer/src/components/chat/ChatTopBar.vue`、`ChatInputToolbar.vue`、`ChatStatusBar.vue`、`MessageList.vue`、`src/renderer/src/components/sidepanel/ChatSidePanel.vue`，约束窄屏 toolbar、popover 和 side panel。
- Modify: `src/renderer/src/i18n/*/chat.json`，补齐 WindowFollower 用户可见文案；以 `zh-CN` 为源运行 i18n 工具同步检查。

### 测试

- Create: `test/main/presenter/managedWindowBounds.test.ts`。
- Extend: `test/main/presenter/windowPresenter.test.ts`。
- Extend: `test/main/windowFollower/contracts.test.ts`、`routesContract.test.ts`、`routeHandler.test.ts`、`windowFollowerPresenter.test.ts`、`windowContextService.test.ts`。
- Create: `test/renderer/stores/windowFollower.test.ts`。
- Create: `test/renderer/components/WindowFollowerSurface.test.ts`、`WindowFollowerToolbar.test.ts`、`WindowFollowerHistoryOverlay.test.ts`。
- Extend: `test/renderer/api/WindowFollowerClient.test.ts`、`test/renderer/components/App.startup.test.ts`、`ChatTabView.test.ts`、`ChatPage.test.ts`、`ChatInputToolbar.test.ts`、`ChatStatusBar.test.ts`、`MessageList.test.ts`、`test/renderer/pages/NewThreadPage.test.ts`。

## Task 1：修复桌面窗口尺寸与自动 DevTools

**Files:**
- Create: `src/main/presenter/windowPresenter/managedWindowBounds.ts`
- Create: `test/main/presenter/managedWindowBounds.test.ts`
- Modify: `src/main/presenter/windowPresenter/index.ts`
- Modify: `test/main/presenter/windowPresenter.test.ts`

- [ ] **Step 1: 先写桌面边界归一化失败测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  DESKTOP_DEFAULT_HEIGHT,
  DESKTOP_DEFAULT_WIDTH,
  DESKTOP_MIN_HEIGHT,
  DESKTOP_MIN_WIDTH,
  normalizeDesktopWindowBounds
} from '@/presenter/windowPresenter/managedWindowBounds'

describe('managed desktop window bounds', () => {
  it('uses a complete DeepChat desktop default', () => {
    expect(DESKTOP_DEFAULT_WIDTH).toBe(1200)
    expect(DESKTOP_DEFAULT_HEIGHT).toBe(800)
  })

  it('clamps a previously persisted compact panel size', () => {
    expect(normalizeDesktopWindowBounds({ x: 20, y: 30, width: 404, height: 700 })).toEqual({
      x: 20,
      y: 30,
      width: DESKTOP_MIN_WIDTH,
      height: 700
    })
    expect(normalizeDesktopWindowBounds({ x: 20, y: 30, width: 800, height: 500 })).toEqual({
      x: 20,
      y: 30,
      width: DESKTOP_MIN_WIDTH,
      height: DESKTOP_MIN_HEIGHT
    })
  })
})
```

- [ ] **Step 2: 运行测试并确认因模块/行为缺失而失败**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/presenter/managedWindowBounds.test.ts`

Expected: FAIL，提示 `managedWindowBounds` 不存在或导出缺失。

- [ ] **Step 3: 实现最小桌面边界模块并接入 BrowserWindow**

```ts
import type { Bounds } from '@shared/windowFollower'

export const DESKTOP_DEFAULT_WIDTH = 1200
export const DESKTOP_DEFAULT_HEIGHT = 800
export const DESKTOP_MIN_WIDTH = 960
export const DESKTOP_MIN_HEIGHT = 640

export function normalizeDesktopWindowBounds(bounds: Bounds): Bounds {
  return {
    ...bounds,
    width: Math.max(DESKTOP_MIN_WIDTH, Math.round(bounds.width)),
    height: Math.max(DESKTOP_MIN_HEIGHT, Math.round(bounds.height))
  }
}
```

在 `createManagedWindow()` 中让 `electron-window-state` 使用 `1200x800`，先归一化其 `x/y/width/height`，再用归一化尺寸做位置校验；`BrowserWindow` 同时设置 `minWidth: 960`、`minHeight: 640`。不得把 panel bounds 写回 state manager。

- [ ] **Step 4: 先写开发模式不自动打开 DevTools 的失败测试**

在 `windowPresenter.test.ts` 构造 dev 模式主窗口并断言：

```ts
it('does not auto-open DevTools for a development main window', async () => {
  const { is } = await import('@electron-toolkit/utils')
  ;(is as { dev: boolean }).dev = true
  const { WindowPresenter } = await import('@/presenter/windowPresenter')
  const presenter = new WindowPresenter({
    getContentProtectionEnabled: vi.fn(() => false)
  } as any)

  await presenter.createAppWindow({ x: 0, y: 0 })

  const window = vi.mocked(BrowserWindow).mock.results.at(-1)?.value as any
  expect(window.webContents.openDevTools).not.toHaveBeenCalled()
  ;(is as { dev: boolean }).dev = false
})
```

- [ ] **Step 5: 运行测试确认当前两个 `openDevTools` 调用使其失败**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/presenter/windowPresenter.test.ts`

Expected: FAIL，`openDevTools` 至少被调用一次。

- [ ] **Step 6: 删除 `createManagedWindow()` 中两处自动打开 DevTools 的分支**

保留 `webPreferences.devTools: is.dev`，从而保留菜单/快捷键手动检查能力；只移除自动 `openDevTools()` 和 `openDevTools({ mode: 'detach' })`。

- [ ] **Step 7: 运行 Task 1 绿灯与回归**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/presenter/managedWindowBounds.test.ts test/main/presenter/windowPresenter.test.ts`

Expected: PASS。

- [ ] **Step 8: 中文提交**

```bash
git add src/main/presenter/windowPresenter/managedWindowBounds.ts src/main/presenter/windowPresenter/index.ts test/main/presenter/managedWindowBounds.test.ts test/main/presenter/windowPresenter.test.ts
git commit -m "fix(sideai): 修复桌面窗口尺寸与开发工具"
```

## Task 2：补齐 typed panel DTO、client 与单一 renderer store

**Files:**
- Modify: `src/shared/windowFollower.ts`
- Modify: `src/shared/contracts/routes/windowFollower.routes.ts`
- Modify: `src/renderer/api/WindowFollowerClient.ts`
- Create: `src/renderer/src/stores/windowFollower.ts`
- Modify: `test/main/windowFollower/contracts.test.ts`
- Modify: `test/main/windowFollower/routesContract.test.ts`
- Modify: `test/renderer/api/WindowFollowerClient.test.ts`
- Create: `test/renderer/stores/windowFollower.test.ts`

- [ ] **Step 1: 先扩展 contract 失败测试**

为 `WindowFollowerDebugDtoSchema` 增加以下断言：

```ts
const state = {
  mode: 'following' as const,
  collapsed: false,
  panelWidth: 360,
  automaticAdhesionAvailable: true,
  snapshot,
  permissions: snapshot.permissions,
  panelBounds: { x: 1204, y: 0, width: 404, height: 800 },
  displayBounds: [{ x: 0, y: 0, width: 1200, height: 900 }],
  placement: 'right' as const,
  contentOffsetX: 44,
  lastError: null,
  updatedAt: 1020
}

expect(WindowFollowerDebugDtoSchema.parse(state)).toEqual(state)
expect(() => WindowFollowerDebugDtoSchema.parse({ ...state, secret: true })).toThrow()
expect(() => WindowFollowerDebugDtoSchema.parse({ ...state, panelWidth: 120 })).toThrow()
```

- [ ] **Step 2: 运行 contract 测试并观察字段被拒绝**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/windowFollower/contracts.test.ts test/main/windowFollower/routesContract.test.ts`

Expected: FAIL，`collapsed`、`panelWidth`、`automaticAdhesionAvailable` 被 strict schema 拒绝。

- [ ] **Step 3: 最小扩展共享 DTO 和 Presenter 输出**

`WindowFollowerDebugDtoSchema` 增加：

```ts
collapsed: z.boolean(),
panelWidth: z.number().finite().min(230),
automaticAdhesionAvailable: z.boolean(),
```

`WindowFollowerPresenter.getDebugState()` 必须从真实 `#collapsed`、归一化 `#panelWidth` 和最近一次 refresh result 输出字段，不能在 renderer 推断。

- [ ] **Step 4: 先写 renderer store 初始化、事件与降级失败测试**

```ts
it('subscribes before loading state and applies the newest event', async () => {
  const pending = deferred<WindowFollowerDebugDto>()
  client.getState.mockReturnValue(pending.promise)
  const store = useWindowFollowerStore()
  const initializing = store.initialize()
  stateListener?.({ ...panelState, panelWidth: 480 })
  pending.resolve(panelState)
  await initializing
  expect(store.state.panelWidth).toBe(480)
})

it('falls back to normal desktop state when initialization fails', async () => {
  client.getState.mockRejectedValue(new Error('bridge unavailable'))
  const store = useWindowFollowerStore()
  await store.initialize()
  expect(store.state.mode).toBe('normal')
  expect(store.initializationError).toContain('bridge unavailable')
})

it('keeps the previous observable state when a command fails', async () => {
  const store = useWindowFollowerStore()
  await store.initialize()
  client.setCollapsed.mockRejectedValue(new Error('native update failed'))
  await expect(store.setCollapsed(true)).rejects.toThrow('native update failed')
  expect(store.state.collapsed).toBe(false)
})
```

- [ ] **Step 5: 运行 store 测试并确认 store 不存在**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/stores/windowFollower.test.ts test/renderer/api/WindowFollowerClient.test.ts`

Expected: FAIL，`useWindowFollowerStore` 不存在。

- [ ] **Step 6: 实现强类型 client 和唯一 Pinia store**

Store 的公开 API 固定为：

```ts
return {
  state: readonly(state),
  initialized: readonly(initialized),
  initializationError: readonly(initializationError),
  commandError: readonly(commandError),
  isPanelMode,
  initialize,
  dispose,
  refresh,
  setMode,
  setCollapsed,
  setWidth,
  setPointerInteractive,
  setAutomaticAdhesion,
  openPermissionSettings
}
```

`initialize()` 必须先订阅 `stateChanged`，再调用 `getState()`；事件 revision 大于初始化开始 revision 时，不允许旧 `getState()` 覆盖事件。任何初始化异常只记录错误并保留 `mode: 'normal'` 的完整默认 DTO。命令只在 typed route 成功返回后替换 state。

- [ ] **Step 7: 运行 Task 2 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/windowFollower/contracts.test.ts test/main/windowFollower/routesContract.test.ts test/renderer/api/WindowFollowerClient.test.ts test/renderer/stores/windowFollower.test.ts`

Expected: PASS。

- [ ] **Step 8: 中文提交**

```bash
git add src/shared/windowFollower.ts src/shared/contracts/routes/windowFollower.routes.ts src/main/presenter/windowFollowerPresenter/index.ts src/renderer/api/WindowFollowerClient.ts src/renderer/src/stores/windowFollower.ts test/main/windowFollower/contracts.test.ts test/main/windowFollower/routesContract.test.ts test/renderer/api/WindowFollowerClient.test.ts test/renderer/stores/windowFollower.test.ts
git commit -m "feat(sideai): 建立贴边容器状态闭环"
```

## Task 3：映射透明 reserve 并恢复真实内容鼠标命中

**Files:**
- Create: `src/renderer/src/components/windowFollower/WindowFollowerSurface.vue`
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/assets/style.css`
- Create: `test/renderer/components/WindowFollowerSurface.test.ts`
- Modify: `test/renderer/components/App.startup.test.ts`

- [ ] **Step 1: 先写 reserve layout 失败测试**

```ts
it('subtracts and translates the real content by a 44px transparent reserve', () => {
  const wrapper = mount(WindowFollowerSurface, {
    props: { mode: 'following', collapsed: false, contentOffsetX: 44 }
  })
  const surface = wrapper.get('[data-testid="window-follower-surface"]')
  expect(surface.attributes('style')).toContain('width: calc(100vw - 44px)')
  expect(surface.attributes('style')).toContain('transform: translateX(44px)')
})

it('does not translate normal or zero-offset content', () => {
  const wrapper = mount(WindowFollowerSurface, {
    props: { mode: 'following', collapsed: false, contentOffsetX: 0 }
  })
  expect(wrapper.get('[data-testid="window-follower-surface"]').attributes('style')).toContain(
    'transform: translateX(0px)'
  )
})

it('keeps content mounted while showing the collapsed bubble', async () => {
  const child = defineComponent({ template: '<input data-testid="draft" value="kept" />' })
  const wrapper = mount(WindowFollowerSurface, {
    props: { mode: 'following', collapsed: false, contentOffsetX: 0 },
    slots: { default: child, collapsed: '<div data-testid="bubble" />' }
  })
  const draft = wrapper.get('[data-testid="draft"]').element
  await wrapper.setProps({ collapsed: true })
  expect(wrapper.get('[data-testid="draft"]').element).toBe(draft)
  expect(wrapper.get('[data-testid="bubble"]').exists()).toBe(true)
})
```

- [ ] **Step 2: 运行并确认 surface 不存在**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/WindowFollowerSurface.test.ts`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现始终挂载的透明 viewport/surface**

核心 template 和 style 必须保持以下结构：

```vue
<div data-testid="window-follower-viewport" class="window-follower-viewport">
  <div
    v-show="!isPanelMode || !collapsed"
    data-testid="window-follower-surface"
    class="window-follower-surface"
    :data-window-follower-surface="isPanelMode ? 'panel' : 'desktop'"
    :style="surfaceStyle"
  >
    <slot />
  </div>
  <div v-if="isPanelMode && collapsed" class="window-follower-collapsed-layer">
    <slot name="collapsed" />
  </div>
</div>
```

```ts
const surfaceStyle = computed(() => ({
  width: props.mode === 'normal' ? '100vw' : `calc(100vw - ${props.contentOffsetX}px)`,
  transform: `translateX(${props.mode === 'normal' ? 0 : props.contentOffsetX}px)`
}))
```

`html`、`body`、`#app`、outer viewport 都保持透明；只有真实 surface 渲染 `bg-background`。

- [ ] **Step 4: 先写 pointer hit-test 失败测试**

```ts
it('reports reserve and content pointer transitions without duplicate calls', async () => {
  const wrapper = mount(WindowFollowerSurface, {
    props: { mode: 'following', collapsed: false, contentOffsetX: 44 }
  })
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20 }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20 }))
  window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }))
  await nextTick()
  expect(wrapper.emitted('pointer-interactive')).toEqual([[false], [true]])
})
```

- [ ] **Step 5: 运行红灯后实现旧 SideAI 判定**

事件判定必须等价于：

```ts
const interactive =
  props.mode !== 'normal' &&
  props.contentOffsetX > 0 &&
  clientX !== null &&
  clientX >= props.contentOffsetX
```

`mousemove` 更新，`mouseleave`、`blur` 和 unmount 发送 `false`；相同布尔值不得重复调用。`App.vue` 把事件接到 `windowFollowerStore.setPointerInteractive()`。

- [ ] **Step 6: 接入 App，初始化/销毁 store，并同步 document dataset/CSS 变量**

`App.vue` 必须在 `onMounted` 调 `initialize()`、`onBeforeUnmount` 调 `dispose()`；watch state 后同步：

```ts
document.documentElement.dataset.windowFollowerSurface = isPanelMode.value ? 'panel' : 'desktop'
document.documentElement.style.setProperty(
  '--window-follower-content-offset-x',
  `${windowFollowerStore.state.contentOffsetX}px`
)
```

- [ ] **Step 7: 运行 Task 3 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/WindowFollowerSurface.test.ts test/renderer/components/App.startup.test.ts`

Expected: PASS。

- [ ] **Step 8: 中文提交**

```bash
git add src/renderer/src/components/windowFollower/WindowFollowerSurface.vue src/renderer/src/App.vue src/renderer/src/assets/style.css test/renderer/components/WindowFollowerSurface.test.ts test/renderer/components/App.startup.test.ts
git commit -m "fix(sideai): 恢复透明预留区与鼠标穿透"
```

## Task 4：完整装配旧 SideAI Presenter 容器行为

**Files:**
- Modify: `src/main/presenter/windowFollowerPresenter/index.ts`
- Modify: `src/main/presenter/windowPresenter/index.ts`
- Modify: `src/main/presenter/index.ts`
- Modify: `test/main/windowFollower/windowFollowerPresenter.test.ts`
- Modify: `test/main/presenter/windowPresenter.test.ts`

- [ ] **Step 1: 先移植旧 recovery 的 Presenter 行为矩阵为失败测试**

至少逐条增加：

```ts
it('expands a fixed collapsed bubble at its user-dragged position', () => {
  presenter.followTarget({ x: 100, y: 100, width: 900, height: 700 })
  presenter.setFixed(true)
  presenter.setCollapsed(true)
  window.moveTo({ x: 1320, y: 240, width: 36, height: 36 })
  presenter.setPanelWidth(480)
  presenter.setCollapsed(false)
  expect(window.getBounds()).toEqual({ x: 1320, y: 240, width: 480, height: 700 })
})

it('does not overwrite a stationary user move on the next refresh', async () => {
  await presenter.refresh()
  presenter.setDetached(true)
  window.moveTo({ x: 900, y: 200, width: 360, height: 700 })
  await presenter.refresh()
  expect(window.getBounds()).toEqual({ x: 900, y: 200, width: 360, height: 700 })
})

it('keeps a following animation target when Electron reports its programmatic move', async () => {
  await presenter.refresh()
  window.emitMove(window.getBounds())
  expect(presenter.getPresentationDebugState().desiredBounds).not.toBeNull()
})

it.each(['following', 'fixed', 'detached'] as const)(
  'keeps webContents identity through %s collapse and expand',
  (mode) => {
    const id = window.webContents.id
    presenter.setMode(mode)
    presenter.setCollapsed(true)
    presenter.setCollapsed(false)
    expect(window.webContents.id).toBe(id)
  }
)
```

Mock window 必须支持 `on/off('move')`、`setPosition`、`setBounds`、`setHasShadow`、`setResizable`、`setMinimizable`、`setMaximizable`、`setFullScreenable`、`setSkipTaskbar` 和 `setWindowButtonVisibility`。

- [ ] **Step 2: 运行 Presenter 测试并确认 fixed/detached/collapsed 失败**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/windowFollower/windowFollowerPresenter.test.ts`

Expected: FAIL；当前实现只在 `following` 更新折叠/宽度，且没有 native move/stationary tracking。

- [ ] **Step 3: 按旧 SideAI 原样装配 presentation state**

Presenter 增加并实际使用：

```ts
#lastAppliedBounds: Bounds | null = null
#desiredBounds: Bounds | null = null
#stationaryExpandedBounds: Bounds | null = null
#expectedProgrammaticBounds: Bounds | null = null
#stationaryModeActive = false
#contentOffsetX = 0
```

进入 `fixed`/`detached` 前用 `captureStationaryExpandedBounds(window.getBounds(), #contentOffsetX)`；折叠和展开统一调用 `calculateStationaryPanelBounds()`；窗口 `move` 事件统一调用 `coordinatePanelNativeMove()`。程序化移动先记录 `#expectedProgrammaticBounds`，尺寸不变时用 `setPosition`，其余用 `setBounds`。

- [ ] **Step 4: 用 update coordinator 替换 refresh 竞态但保留 forced permission 语义**

```ts
#forcePermissionRefreshRequested = false
#updateCoordinator = createPanelUpdateCoordinator(async () => {
  const forcePermissions = this.#forcePermissionRefreshRequested
  this.#forcePermissionRefreshRequested = false
  await this.runRefresh(forcePermissions)
})

refresh(forcePermissions = false) {
  if (forcePermissions) {
    this.#forcePermissionRefreshRequested = true
    return this.#updateCoordinator.updateFresh()
  }
  return this.#updateCoordinator.update()
}
```

保留现有“普通 refresh 进行中时，发送消息要求的强制权限 refresh 必须再跑一次”的测试。

- [ ] **Step 5: 切换同一 BrowserWindow 的 native chrome**

panel 模式设置：隐藏 macOS window buttons、禁止 resize/minimize/maximize/fullscreen、保持透明、按 collapsed/reserve 设置 shadow；normal 模式恢复 window buttons、resize/minimize/maximize/fullscreen、desktop minimum size、shadow 和普通 bounds。两条路径都不得调用 `loadURL`、`loadFile`、`reload` 或创建新窗口。

- [ ] **Step 6: 运行 Presenter 与 window chrome 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/windowFollower/windowFollowerPresenter.test.ts test/main/presenter/windowPresenter.test.ts test/main/windowFollower/core.test.ts`

Expected: PASS。

- [ ] **Step 7: 中文提交**

```bash
git add src/main/presenter/windowFollowerPresenter/index.ts src/main/presenter/windowPresenter/index.ts src/main/presenter/index.ts test/main/windowFollower/windowFollowerPresenter.test.ts test/main/presenter/windowPresenter.test.ts
git commit -m "feat(sideai): 恢复完整贴边窗口行为"
```

## Task 5：补齐容器 commands、设置与排除应用闭环

**Files:**
- Modify: `src/shared/windowFollower.ts`
- Modify: `src/shared/contracts/routes/windowFollower.routes.ts`
- Modify: `src/main/routes/windowFollowerRoutes.ts`
- Modify: `src/main/windowFollower/windowContextService.ts`
- Modify: `src/main/presenter/windowFollowerPresenter/index.ts`
- Modify: `src/main/presenter/index.ts`
- Modify: `src/renderer/api/WindowFollowerClient.ts`
- Modify: `src/renderer/src/stores/windowFollower.ts`
- Modify: `test/main/windowFollower/routesContract.test.ts`
- Modify: `test/main/windowFollower/routeHandler.test.ts`
- Modify: `test/main/windowFollower/windowContextService.test.ts`
- Modify: `test/renderer/api/WindowFollowerClient.test.ts`
- Modify: `test/renderer/stores/windowFollower.test.ts`

- [ ] **Step 1: 先写完整 command catalog 失败测试**

Catalog 必须包含：

```ts
expect(Object.keys(DEEPCHAT_ROUTE_CATALOG)).toEqual(
  expect.arrayContaining([
    'windowFollower.resetWidth',
    'windowFollower.getSettings',
    'windowFollower.excludeCurrentApp',
    'windowFollower.removeExcludedApp',
    'windowFollower.hide',
    'windowFollower.quit'
  ])
)
```

设置 DTO 使用 strict schema：

```ts
const WindowFollowerSettingsDtoSchema = z.strictObject({
  automaticAdhesion: z.boolean(),
  currentApp: AppIdentitySchema.nullable(),
  excludedApps: z.array(ExcludedAppSchema)
})
```

- [ ] **Step 2: 运行 routes/handler 红灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/windowFollower/routesContract.test.ts test/main/windowFollower/routeHandler.test.ts`

Expected: FAIL，route catalog 和 presenter command 缺失。

- [ ] **Step 3: 添加 typed routes 并保持主进程所有权**

输入/输出固定为：

```ts
windowFollower.resetWidth: {} -> { state }
windowFollower.getSettings: {} -> { settings }
windowFollower.excludeCurrentApp: {} -> { settings, state }
windowFollower.removeExcludedApp: { id: string } -> { settings, state }
windowFollower.hide: {} -> { hidden: boolean }
windowFollower.quit: {} -> { requested: true }
```

`quit` 通过 `WINDOW_EVENTS.FORCE_QUIT_APP` 进入 DeepChat lifecycle shutdown；不得从 renderer 或 route 直接调用裸 IPC。`hide` 只隐藏 primary window。`resetWidth` 使用旧 SideAI `PANEL_WIDTH`。

- [ ] **Step 4: 先写排除应用持久化/刷新失败测试**

```ts
it('persists exclusion only after a readable current target exists', async () => {
  await service.refresh(true)
  await service.excludeCurrentApp()
  expect(persistExcludedApps).toHaveBeenCalledWith([
    expect.objectContaining({ id: 'bundleId:com.example.Editor', name: 'Editor' })
  ])
  expect((await service.refresh()).snapshot).toBeNull()
})

it('removes an exclusion and makes a future live target available again', async () => {
  await service.removeExcludedApp('bundleId:com.example.Editor')
  expect((await service.refresh()).snapshot?.app.stableKey).toBe(
    'bundleId:com.example.Editor'
  )
})
```

- [ ] **Step 5: 装配现有 exclusion core，不重写匹配算法**

`WindowContextService` 接收 `initialExcludedApps` 与 `persistExcludedApps`，公开 `getAdhesionSettings()`、`excludeCurrentApp()`、`removeExcludedApp()`；内部继续调用已迁入的 `excludeCurrentAppWithUpdate()` / `removeExcludedAppWithUpdate()` / `isOwnerExcluded()`。配置键固定为 `sideai.windowFollower.excludedApps`。

- [ ] **Step 6: 扩展 client/store，命令失败仍保留上一份 state/settings**

Store 新增 `settings`、`loadSettings`、`resetWidth`、`excludeCurrentApp`、`removeExcludedApp`、`hide`、`quit`。任何失败只写 `commandError`，不得乐观删除排除项或改变 panel state。

- [ ] **Step 7: 运行 Task 5 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/main/windowFollower/routesContract.test.ts test/main/windowFollower/routeHandler.test.ts test/main/windowFollower/windowContextService.test.ts test/renderer/api/WindowFollowerClient.test.ts test/renderer/stores/windowFollower.test.ts`

Expected: PASS。

- [ ] **Step 8: 中文提交**

```bash
git add src/shared/windowFollower.ts src/shared/contracts/routes/windowFollower.routes.ts src/main/routes/windowFollowerRoutes.ts src/main/windowFollower/windowContextService.ts src/main/presenter/windowFollowerPresenter/index.ts src/main/presenter/index.ts src/renderer/api/WindowFollowerClient.ts src/renderer/src/stores/windowFollower.ts test/main/windowFollower/routesContract.test.ts test/main/windowFollower/routeHandler.test.ts test/main/windowFollower/windowContextService.test.ts test/renderer/api/WindowFollowerClient.test.ts test/renderer/stores/windowFollower.test.ts
git commit -m "feat(sideai): 接通贴边容器控制与设置"
```

## Task 6：实现旧 SideAI 工具栏、气泡、宽度和设置 UI

**Files:**
- Create: `src/renderer/src/components/windowFollower/WindowFollowerToolbar.vue`
- Create: `src/renderer/src/components/windowFollower/WindowFollowerCollapsedBubble.vue`
- Create: `src/renderer/src/components/windowFollower/WindowFollowerResizeHandle.vue`
- Create: `src/renderer/src/components/windowFollower/WindowFollowerSettingsPanel.vue`
- Modify: `src/renderer/src/App.vue`
- Create: `test/renderer/components/WindowFollowerToolbar.test.ts`
- Create: `test/renderer/components/WindowFollowerCollapsedBubble.test.ts`
- Create: `test/renderer/components/WindowFollowerResizeHandle.test.ts`
- Create: `test/renderer/components/WindowFollowerSettingsPanel.test.ts`

- [ ] **Step 1: 先写工具栏结构与独立折叠语义失败测试**

```ts
it('starts with only the horizontal group toggle and a drag region', () => {
  const wrapper = mountToolbar()
  expect(wrapper.get('[data-testid="window-follower-toolbar-toggle"]')).toBeTruthy()
  expect(wrapper.get('[data-testid="window-follower-toolbar-drag"]')).toBeTruthy()
  expect(wrapper.find('[data-testid="window-follower-collapse-panel"]').exists()).toBe(false)
})

it('expands every accepted SideAI command in the original order', async () => {
  const wrapper = mountToolbar()
  await wrapper.get('[data-testid="window-follower-toolbar-toggle"]').trigger('click')
  expect(
    wrapper.findAll('[data-window-follower-command]').map((node) => node.attributes('data-window-follower-command'))
  ).toEqual(['collapse', 'pin', 'detach', 'reset-width', 'settings', 'hide', 'quit'])
})

it('does not treat the toolbar group toggle as panel collapse', async () => {
  const wrapper = mountToolbar()
  await wrapper.get('[data-testid="window-follower-toolbar-toggle"]').trigger('click')
  expect(store.setCollapsed).not.toHaveBeenCalled()
  await wrapper.get('[data-testid="window-follower-collapse-panel"]').trigger('click')
  expect(store.setCollapsed).toHaveBeenCalledWith(true)
})
```

- [ ] **Step 2: 运行红灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/WindowFollowerToolbar.test.ts`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现工具栏，全部按钮用 `lucide:*` 图标和 tooltip**

命令与图标固定为：

```ts
const commands = [
  { id: 'collapse', icon: 'lucide:panel-right-close' },
  { id: 'pin', icon: state.mode === 'fixed' ? 'lucide:pin-off' : 'lucide:pin' },
  { id: 'detach', icon: state.mode === 'detached' ? 'lucide:magnet' : 'lucide:magnet-off' },
  { id: 'reset-width', icon: 'lucide:panel-right-dashed' },
  { id: 'settings', icon: 'lucide:ellipsis' },
  { id: 'hide', icon: 'lucide:eye-off' },
  { id: 'quit', icon: 'lucide:power' }
] as const
```

固定与脱吸附保持互斥选中态。执行普通 command 后横向按钮组收回；打开设置时先收回按钮组再显示 settings panel。`toolbar-toggle` 和真实 panel collapse 是两个不同按钮、两个不同 state。

- [ ] **Step 4: 先写气泡原地展开和 resize 节流失败测试**

```ts
it('expands the native panel without remounting chat content', async () => {
  await wrapper.get('[data-testid="window-follower-bubble-expand"]').trigger('click')
  expect(store.setCollapsed).toHaveBeenCalledWith(false)
})

it('sends the latest rounded width once per animation frame', async () => {
  await handle.trigger('pointerdown', { pointerId: 1, clientX: 100 })
  await handle.trigger('pointermove', { pointerId: 1, clientX: 140 })
  await handle.trigger('pointermove', { pointerId: 1, clientX: 160 })
  await vi.runAllTimersAsync()
  expect(store.setWidth).toHaveBeenLastCalledWith(420)
})
```

- [ ] **Step 5: 实现 36px outer bubble、22px expand hit 和旧宽度计算**

气泡 outer 使用 `-webkit-app-region: drag`，22px expand button 使用 `no-drag`；resize 从真实 surface `getBoundingClientRect().width` 起算，`requestAnimationFrame` 合并 move，pointer up 强制 flush。

- [ ] **Step 6: 先写 settings panel 失败测试后实现**

Settings panel 必须展示并调用：自动贴边 `Switch`、panel width `Slider`/数值、两项权限按钮、排除当前应用、排除列表恢复按钮、打开 WindowFollower debug、返回。不得新建第二个 settings `BrowserWindow`。

- [ ] **Step 7: 运行 Task 6 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/WindowFollowerToolbar.test.ts test/renderer/components/WindowFollowerCollapsedBubble.test.ts test/renderer/components/WindowFollowerResizeHandle.test.ts test/renderer/components/WindowFollowerSettingsPanel.test.ts`

Expected: PASS。

- [ ] **Step 8: 中文提交**

```bash
git add src/renderer/src/components/windowFollower/WindowFollowerToolbar.vue src/renderer/src/components/windowFollower/WindowFollowerCollapsedBubble.vue src/renderer/src/components/windowFollower/WindowFollowerResizeHandle.vue src/renderer/src/components/windowFollower/WindowFollowerSettingsPanel.vue src/renderer/src/App.vue test/renderer/components/WindowFollowerToolbar.test.ts test/renderer/components/WindowFollowerCollapsedBubble.test.ts test/renderer/components/WindowFollowerResizeHandle.test.ts test/renderer/components/WindowFollowerSettingsPanel.test.ts
git commit -m "feat(sideai): 实现完整贴边容器工具栏"
```

## Task 7：把 DeepChat 原组件重排为窄面板布局

**Files:**
- Modify: `src/renderer/src/App.vue`
- Modify: `src/renderer/src/views/ChatTabView.vue`
- Modify: `src/renderer/src/pages/ChatPage.vue`
- Modify: `src/renderer/src/pages/NewThreadPage.vue`
- Modify: `src/renderer/src/components/chat/ChatTopBar.vue`
- Modify: `src/renderer/src/components/chat/ChatInputToolbar.vue`
- Modify: `src/renderer/src/components/chat/ChatStatusBar.vue`
- Modify: `src/renderer/src/components/chat/MessageList.vue`
- Modify: `src/renderer/src/components/sidepanel/ChatSidePanel.vue`
- Modify: `test/renderer/components/App.startup.test.ts`
- Modify: `test/renderer/components/ChatTabView.test.ts`
- Modify: `test/renderer/components/ChatPage.test.ts`
- Modify: `test/renderer/pages/NewThreadPage.test.ts`
- Modify: `test/renderer/components/ChatInputToolbar.test.ts`
- Modify: `test/renderer/components/ChatStatusBar.test.ts`
- Modify: `test/renderer/components/MessageList.test.ts`

- [ ] **Step 1: 先写同一 renderer 树的 desktop/panel 失败测试**

```ts
it('shows desktop chrome only in normal mode', async () => {
  expect(wrapper.getComponent({ name: 'AppBar' }).isVisible()).toBe(true)
  expect(wrapper.getComponent({ name: 'WindowSideBar' }).isVisible()).toBe(true)
  state.mode = 'following'
  await nextTick()
  expect(wrapper.getComponent({ name: 'AppBar' }).isVisible()).toBe(false)
  expect(wrapper.getComponent({ name: 'WindowSideBar' }).isVisible()).toBe(false)
  expect(wrapper.get('[data-testid="window-follower-toolbar"]').isVisible()).toBe(true)
})

it('keeps the same routed chat DOM node while switching layout mode', async () => {
  const routedNode = wrapper.get('[data-testid="router-content"]').element
  state.mode = 'following'
  await nextTick()
  expect(wrapper.get('[data-testid="router-content"]').element).toBe(routedNode)
})
```

- [ ] **Step 2: 运行 App/ChatTabView 红灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/App.startup.test.ts test/renderer/components/ChatTabView.test.ts`

Expected: FAIL；当前 panel 仍显示 `AppBar` 和 `WindowSideBar`。

- [ ] **Step 3: 用 `v-show` 重排同一组件树**

`AppBar`/`WindowSideBar` 在 panel mode 下 `v-show=false`；WindowFollower toolbar 在 normal 下 `v-show=false`；承载 `RouterView` 的 main DOM 不使用 mode key、不使用 mode 分支重建。Chat side panel 在窄模式变为覆盖当前聊天区域的 overlay，而不是继续占用 360px 横向宽度。

- [ ] **Step 4: 先写 ChatPage/NewThreadPage compact 失败测试**

测试要求：

```ts
expect(wrapper.get('[data-testid="chat-message-list"]').classes()).toContain('window-follower-compact')
expect(wrapper.get('[data-testid="chat-input-box"]').exists()).toBe(true)
expect(wrapper.get('[data-testid="new-thread-page"]').classes()).toContain(
  'new-thread-page--window-follower'
)
expect(wrapper.get('[data-testid="new-thread-project-trigger"]').exists()).toBe(true)
expect(wrapper.get('[data-testid="chat-send-button"]').exists()).toBe(true)
```

- [ ] **Step 5: 最小重排而不复制 DeepChat 业务逻辑**

- `MessageList` compact 时把水平 padding 从 24px 降为 12px。
- `ChatPage` sticky input compact 时使用 12px padding，继续挂载原 `ChatInputBox`、`PendingInputLane`、Agent plan/question overlay 和 `ChatStatusBar`。
- `NewThreadPage` compact 时隐藏大 logo、降低标题尺寸、用单列受限高度布局，但继续挂载原 project selector、Agent/Provider/model logic、同一个 draft 和 `ChatInputBox`。
- `ChatInputToolbar` compact 时允许两端控件换行但保持 attachment、voice、steer、queue、send/stop 全部可达。
- `ChatStatusBar` compact 时使用横向可滚动/overflow menu；不删除 Provider、model、Agent/ACP、MCP、技能或工具入口。
- `ChatTopBar` compact 时隐藏当前会话标题和 project copy，保留原 DeepChat workspace/share/more 行为。

- [ ] **Step 6: 运行定向 renderer 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/App.startup.test.ts test/renderer/components/ChatTabView.test.ts test/renderer/components/ChatPage.test.ts test/renderer/pages/NewThreadPage.test.ts test/renderer/components/ChatInputToolbar.test.ts test/renderer/components/ChatStatusBar.test.ts test/renderer/components/MessageList.test.ts`

Expected: PASS。

- [ ] **Step 7: 中文提交**

```bash
git add src/renderer/src/App.vue src/renderer/src/views/ChatTabView.vue src/renderer/src/pages/ChatPage.vue src/renderer/src/pages/NewThreadPage.vue src/renderer/src/components/chat/ChatTopBar.vue src/renderer/src/components/chat/ChatInputToolbar.vue src/renderer/src/components/chat/ChatStatusBar.vue src/renderer/src/components/chat/MessageList.vue src/renderer/src/components/sidepanel/ChatSidePanel.vue test/renderer/components/App.startup.test.ts test/renderer/components/ChatTabView.test.ts test/renderer/components/ChatPage.test.ts test/renderer/pages/NewThreadPage.test.ts test/renderer/components/ChatInputToolbar.test.ts test/renderer/components/ChatStatusBar.test.ts test/renderer/components/MessageList.test.ts
git commit -m "feat(sideai): 重排 DeepChat 窄面板布局"
```

## Task 8：实现新对话、历史浮层与恢复大窗口

**Files:**
- Create: `src/renderer/src/components/windowFollower/WindowFollowerSessionControls.vue`
- Create: `src/renderer/src/components/windowFollower/WindowFollowerHistoryOverlay.vue`
- Modify: `src/renderer/src/views/ChatTabView.vue`
- Modify: `src/renderer/src/components/chat/ChatTopBar.vue`
- Create: `test/renderer/components/WindowFollowerHistoryOverlay.test.ts`
- Modify: `test/renderer/components/ChatTabView.test.ts`

- [ ] **Step 1: 先写 session controls 可见性失败测试**

```ts
it('hides new chat for an unsent blank new thread', async () => {
  const { wrapper } = await setup({ currentRoute: 'newThread', activeSessionId: null })
  expect(wrapper.find('[data-testid="window-follower-new-chat"]').exists()).toBe(false)
  expect(wrapper.get('[data-testid="window-follower-history"]')).toBeTruthy()
  expect(wrapper.get('[data-testid="window-follower-restore-window"]')).toBeTruthy()
})

it('shows new chat for a formal active session', async () => {
  const { wrapper } = await setup({ currentRoute: 'chat', activeSessionId: 'session-42' })
  expect(wrapper.get('[data-testid="window-follower-new-chat"]')).toBeTruthy()
})
```

- [ ] **Step 2: 运行 ChatTabView 红灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/ChatTabView.test.ts`

Expected: FAIL，panel session controls 不存在。

- [ ] **Step 3: 实现右上角 controls 并只调用现有 stores/client**

行为固定为：

```ts
const showNewChat = computed(() => sessionStore.hasActiveSession)
const newChat = () => sessionStore.startNewConversation({ refresh: true })
const toggleHistory = () => emit('toggle-history')
const restoreWindow = () => windowFollowerStore.setMode('normal')
```

controls 只在 panel surface 显示；用 `lucide:square-pen`、`lucide:history`、`lucide:panel-top-open`，全部有 tooltip/aria-label。

- [ ] **Step 4: 先写历史分组、分页、切换和关闭失败测试**

```ts
it('renders existing session groups and selects through the session store', async () => {
  const wrapper = mountHistory({ sessionGroups: groups })
  await wrapper.get('[data-session-id="session-2"]').trigger('click')
  expect(sessionStore.selectSession).toHaveBeenCalledWith('session-2')
  expect(wrapper.emitted('close')).toHaveLength(1)
})

it('loads the next existing session page near the overlay bottom', async () => {
  sessionStore.hasMore = true
  await wrapper.get('[data-testid="window-follower-history-list"]').trigger('scroll')
  expect(sessionStore.loadNextPage).toHaveBeenCalledOnce()
})

it.each(['backdrop', 'escape', 'history-toggle'])('closes by %s', async (method) => {
  await closeBy(method)
  expect(wrapper.emitted('close')).toHaveLength(1)
})
```

- [ ] **Step 5: 实现覆盖消息区的历史浮层**

浮层直接读取 `getPinnedSessions(null)`、`sessionGroups`、`loading`、`loadingMore`、`hasMore`，调用 `loadNextPage()` 和 `selectSession()`；保留当前 store 的 time/project grouping，不复制 pagination cursor 或 SessionClient。选择会话、backdrop、Escape、再次点击历史都关闭。

- [ ] **Step 6: 运行 Task 8 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/WindowFollowerHistoryOverlay.test.ts test/renderer/components/ChatTabView.test.ts`

Expected: PASS。

- [ ] **Step 7: 中文提交**

```bash
git add src/renderer/src/components/windowFollower/WindowFollowerSessionControls.vue src/renderer/src/components/windowFollower/WindowFollowerHistoryOverlay.vue src/renderer/src/views/ChatTabView.vue src/renderer/src/components/chat/ChatTopBar.vue test/renderer/components/WindowFollowerHistoryOverlay.test.ts test/renderer/components/ChatTabView.test.ts
git commit -m "feat(sideai): 增加会话操作与历史浮层"
```

## Task 9：约束 panel 弹层、首次引导和多语言文案

**Files:**
- Modify: `src/renderer/src/assets/style.css`
- Modify: `src/renderer/src/pages/WelcomePage.vue`
- Modify: `src/renderer/src/components/onboarding/GuidedOnboardingOverlay.vue`
- Modify: `src/renderer/src/components/settings/ModelCheckDialog.vue`
- Modify: `src/renderer/src/i18n/*/chat.json`
- Modify: `test/renderer/components/NewThreadPage.onboarding.test.ts`
- Modify: `test/renderer/components/ModelCheckDialog.test.ts`

- [ ] **Step 1: 先写窄 viewport 弹层失败测试**

测试在 `document.documentElement.dataset.windowFollowerSurface = 'panel'` 且 reserve 为 44px 时，要求 dialog/popover/dropdown 的最大宽度使用真实内容宽度，并要求 ModelCheck 表单从四列降为单列。

```ts
expect(dialog.classes()).toContain('window-follower-viewport-bound')
expect(wrapper.get('[data-testid="model-check-form"]').classes()).toContain(
  'window-follower-single-column'
)
expect(wrapper.get('[data-testid="guided-onboarding-overlay"]').exists()).toBe(true)
```

- [ ] **Step 2: 运行 onboarding/dialog 红灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/NewThreadPage.onboarding.test.ts test/renderer/components/ModelCheckDialog.test.ts`

Expected: FAIL，当前 fixed width/grid 仍按桌面布局。

- [ ] **Step 3: 增加全局 panel portal 约束**

```css
html[data-window-follower-surface='panel'] [data-slot='dialog-content'],
html[data-window-follower-surface='panel'] [data-slot='alert-dialog-content'],
html[data-window-follower-surface='panel'] [data-slot='popover-content'],
html[data-window-follower-surface='panel'] [data-slot='dropdown-menu-content'] {
  max-width: calc(
    100vw - var(--window-follower-content-offset-x, 0px) - 1rem
  ) !important;
  max-height: calc(100vh - 1rem);
}
```

Welcome provider/guide 区在 panel 下使用单列或两列紧凑布局；GuidedOnboarding panel 继续用 viewport clamp；任何 portal 都不能进入左侧透明 reserve。

- [ ] **Step 4: 补齐 WindowFollower i18n key 并生成类型**

新增 key 统一放在 `chat.windowFollower`：toolbar 展开/收起、气泡、固定、取消固定、脱吸附、恢复吸附、恢复宽度、设置、隐藏、退出、自动贴边、排除当前应用、历史、恢复大窗口和本地错误。以 `zh-CN`、`en-US` 提供明确文案，再运行项目 i18n 工具保持所有 locale key 一致。

- [ ] **Step 5: 运行 Task 9 绿灯**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts test/renderer/components/NewThreadPage.onboarding.test.ts test/renderer/components/ModelCheckDialog.test.ts`

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm run i18n`

Expected: PASS。

- [ ] **Step 6: 中文提交**

```bash
git add src/renderer/src/assets/style.css src/renderer/src/pages/WelcomePage.vue src/renderer/src/components/onboarding/GuidedOnboardingOverlay.vue src/renderer/src/components/settings/ModelCheckDialog.vue src/renderer/src/i18n src/types/i18n.d.ts test/renderer/components/NewThreadPage.onboarding.test.ts test/renderer/components/ModelCheckDialog.test.ts
git commit -m "fix(sideai): 约束贴边弹层与首次引导"
```

## Task 10：完整自动验证、Electron 启动与用户验收交接

**Files:**
- Modify: `docs/architecture/window-follower-integration/tasks.md`
- Create: `docs/session-notes/2026-07-12-window-follower-container-verification.md`

- [ ] **Step 1: 运行 WindowFollower 全部定向测试**

```bash
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts \
  test/main/windowFollower \
  test/main/presenter/windowPresenter.test.ts \
  test/renderer/api/WindowFollowerClient.test.ts \
  test/renderer/stores/windowFollower.test.ts \
  test/renderer/components/WindowFollowerSurface.test.ts \
  test/renderer/components/WindowFollowerToolbar.test.ts \
  test/renderer/components/WindowFollowerCollapsedBubble.test.ts \
  test/renderer/components/WindowFollowerResizeHandle.test.ts \
  test/renderer/components/WindowFollowerSettingsPanel.test.ts \
  test/renderer/components/WindowFollowerHistoryOverlay.test.ts \
  test/renderer/components/ChatTabView.test.ts \
  test/renderer/components/ChatPage.test.ts \
  test/renderer/pages/NewThreadPage.test.ts
```

Expected: 0 failures。

- [ ] **Step 2: 运行 DeepChat 原生能力定向回归**

```bash
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm exec vitest run --config vitest.config.ts \
  test/main/routes/dispatcher.test.ts \
  test/main/presenter/agentRuntimePresenter \
  test/main/presenter/agentSessionPresenter/agentSessionPresenter.test.ts \
  test/renderer/components/ChatInputToolbar.test.ts \
  test/renderer/components/ChatStatusBar.test.ts \
  test/renderer/components/MessageList.test.ts
```

Expected: 不新增失败；Provider、Agent、CLI、MCP、技能、工具和 CUA 发送路径仍使用 DeepChat 原实现。

- [ ] **Step 3: 运行全量静态与构建验证**

```bash
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm run format
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm run i18n
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm run lint
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm run typecheck
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm test -- --run
PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm run build
git diff --check
```

Expected: format/i18n/lint/typecheck/build 通过；全量测试只允许交接记录中已在官方 v1.0.9 重现的 5 项失败，不得新增失败。记录三个 prebuild 生成资源的实际变化，不擅自回滚。

- [ ] **Step 4: 运行架构边界检查**

```bash
test ! -e vendor/deepchat
! git diff upstream/main...HEAD -- .env.example
! rg -n "SIDEAI_PROXY|DEEPSEEK_API_KEY|ipcRenderer\.(invoke|send)" src/renderer/src src/renderer/api
git status --short --branch
git rev-parse HEAD
git rev-parse origin/sideai/window-follower-integration
```

Expected: 不存在 vendor、自建 Key/proxy 或新增裸 IPC；`.superpowers/` 仍未跟踪且未提交。

- [ ] **Step 5: 写验证记录但不勾选人工验收完成**

记录每条命令 exit code、通过/跳过/已知失败数量、生成资源 diff、当前 `webContents.id` 自动测试证据。`tasks.md` 只勾选自动验证，不勾选用户验收、PR 或 main 晋升。

- [ ] **Step 6: 中文提交自动验证记录**

```bash
git add docs/architecture/window-follower-integration/tasks.md docs/session-notes/2026-07-12-window-follower-container-verification.md resources/acp-registry/registry.json resources/model-db/providers.json src/renderer/src/lib/icons/icon-collections.generated.ts
git commit -m "test(sideai): 记录贴边容器自动验证"
```

只添加实际变更的生成资源；没有变化的文件不强行加入。

- [ ] **Step 7: 启动 Electron，保持进程运行供用户人工验收**

Run: `PATH="$HOME/.nvm/versions/node/v24.14.1/bin:$PATH" pnpm run dev`

必须让用户实际检查：

1. 普通窗口只有一个应用窗口、完整桌面布局和首次引导，无自动 DevTools。
2. 单显示器右边缘 reserve 透明且可穿透；右侧真实显示器、负坐标和上下排列场景无假 reserve。
3. 顶部全部旧 SideAI 按钮存在；按钮组横向收起/展开与面板气泡折叠互不混淆。
4. 固定、脱吸附、拖动、折叠后原地展开、宽度拖动/重置、设置、隐藏、退出工作正常。
5. 新对话可见性正确，历史浮层能分页和切换，恢复大窗口不 reload。
6. 草稿、流式任务、Provider、自定义 Key、Agent、附件、CLI、MCP、技能、工具、CUA 和真实聊天发送正常。
7. 用调试页或运行时日志确认 normal/panel/collapsed 全程保持同一个 `webContents.id`。

- [ ] **Step 8: 停在用户验收门槛**

用户明确验收前：不创建 PR、不推 main、不更新任何“完成/可交付”结论。若人工验收发现问题，为每个问题重新进入 `superpowers:systematic-debugging` + TDD 红绿循环。

## 自检结果

- Spec coverage：普通窗口、唯一窗口、透明 reserve、多显示器、鼠标穿透、旧 toolbar、按钮组折叠、气泡、stationary move、宽度、设置、窄布局、会话按钮、历史分页、弹层约束、DeepChat 原生能力和人工验收均有对应任务。
- Placeholder scan：计划不含 `TBD`、`TODO` 或未定义的“稍后实现”步骤。
- Type consistency：renderer 全程消费 `WindowFollowerDebugDto`；`mode` 保持 `following | fixed | detached | normal`；settings 使用独立 `WindowFollowerSettingsDto`；所有命令走 `WindowFollowerClient`。
- Git boundary：所有示例提交为中文 Conventional Commit；没有 PR、main 晋升或强推步骤。
