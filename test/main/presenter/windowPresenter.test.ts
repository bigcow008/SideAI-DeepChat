import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'
import { CONFIG_EVENTS, SETTINGS_EVENTS, SHORTCUT_EVENTS, WINDOW_EVENTS } from '@/events'
import { eventBus } from '@/eventbus'

const activateAppOnMacMock = vi.hoisted(() => vi.fn())
const originalBrowserWindowFromId = (BrowserWindow as any).fromId

vi.mock('@/lib/activateApp', () => ({
  activateAppOnMac: activateAppOnMacMock
}))

vi.mock('electron-window-state', () => ({
  default: vi.fn(() => ({
    x: 0,
    y: 0,
    width: 900,
    height: 600,
    manage: vi.fn(),
    unmanage: vi.fn()
  }))
}))

vi.mock('@/presenter', () => ({
  presenter: {
    tabPresenter: {
      getWindowTabsData: vi.fn().mockResolvedValue([])
    },
    devicePresenter: {
      restartApp: vi.fn()
    }
  }
}))

describe('WindowPresenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    ;(BrowserWindow as any).fromId = originalBrowserWindowFromId
    is.dev = false
    eventBus.removeAllListeners(SHORTCUT_EVENTS.CREATE_NEW_WINDOW)
    eventBus.removeAllListeners(SHORTCUT_EVENTS.GO_SETTINGS)
    eventBus.removeAllListeners(CONFIG_EVENTS.CONTENT_PROTECTION_CHANGED)
    eventBus.removeAllListeners(WINDOW_EVENTS.SET_APPLICATION_QUITTING)
  })

  it('clamps persisted compact bounds and sets a complete desktop minimum size', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)

    await presenter.createAppWindow({ x: 0, y: 0 })

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 960,
        height: 640,
        minWidth: 960,
        minHeight: 640
      })
    )
  })

  it('does not auto-open DevTools for a development main window', async () => {
    is.dev = true
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)

    await presenter.createAppWindow({ x: 0, y: 0 })

    const window = vi.mocked(BrowserWindow).mock.results.at(-1)?.value as any
    expect(window.webContents.openDevTools).not.toHaveBeenCalled()
  })

  it('returns the tracked main BrowserWindow even when another window is focused', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)
    const mainWindow = { id: 7, isDestroyed: vi.fn(() => false) }
    ;(presenter as any).mainWindowId = 7
    ;(BrowserWindow as any).fromId = vi.fn(() => mainWindow)

    expect(presenter.getPrimaryWindow()).toBe(mainWindow)
  })

  it('suspends persisted state while the main window uses panel bounds', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)
    const mainWindow = { id: 7, isDestroyed: vi.fn(() => false) }
    const stateManager = { manage: vi.fn(), unmanage: vi.fn() }
    ;(presenter as any).mainWindowId = 7
    ;(presenter as any).mainWindowStateManager = stateManager
    ;(BrowserWindow as any).fromId = vi.fn(() => mainWindow)

    presenter.suspendPrimaryWindowStateTracking()
    presenter.resumePrimaryWindowStateTracking()

    expect(stateManager.unmanage).toHaveBeenCalledOnce()
    expect(stateManager.manage).toHaveBeenCalledWith(mainWindow)
  })

  it('applies compact native chrome to the same primary window in panel mode', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)
    const mainWindow = {
      id: 7,
      isDestroyed: vi.fn(() => false),
      setMinimumSize: vi.fn(),
      setResizable: vi.fn(),
      setMinimizable: vi.fn(),
      setMaximizable: vi.fn(),
      setFullScreenable: vi.fn(),
      setWindowButtonVisibility: vi.fn(),
      setHasShadow: vi.fn(),
      setSkipTaskbar: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn()
    }
    ;(presenter as any).mainWindowId = 7
    ;(BrowserWindow as any).fromId = vi.fn(() => mainWindow)

    presenter.enterPrimaryWindowFollowerPresentation({
      collapsed: false,
      hasTransparentReserve: true
    })

    expect(mainWindow.setMinimumSize).toHaveBeenCalledWith(36, 36)
    expect(mainWindow.setResizable).toHaveBeenCalledWith(false)
    expect(mainWindow.setMinimizable).toHaveBeenCalledWith(false)
    expect(mainWindow.setMaximizable).toHaveBeenCalledWith(false)
    expect(mainWindow.setFullScreenable).toHaveBeenCalledWith(false)
    expect(mainWindow.setWindowButtonVisibility).toHaveBeenCalledWith(false)
    expect(mainWindow.setHasShadow).toHaveBeenCalledWith(false)
    expect(mainWindow.setSkipTaskbar).toHaveBeenCalledWith(true)
    expect(mainWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
      visibleOnFullScreen: true
    })
  })

  it('restores desktop native chrome after leaving panel mode', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)
    const mainWindow = {
      id: 7,
      isDestroyed: vi.fn(() => false),
      setMinimumSize: vi.fn(),
      setResizable: vi.fn(),
      setMinimizable: vi.fn(),
      setMaximizable: vi.fn(),
      setFullScreenable: vi.fn(),
      setWindowButtonVisibility: vi.fn(),
      setHasShadow: vi.fn(),
      setSkipTaskbar: vi.fn(),
      setHiddenInMissionControl: vi.fn(),
      setVisibleOnAllWorkspaces: vi.fn()
    }
    ;(presenter as any).mainWindowId = 7
    ;(BrowserWindow as any).fromId = vi.fn(() => mainWindow)

    presenter.restorePrimaryWindowPresentation()

    expect(mainWindow.setMinimumSize).toHaveBeenCalledWith(960, 640)
    expect(mainWindow.setResizable).toHaveBeenCalledWith(true)
    expect(mainWindow.setMinimizable).toHaveBeenCalledWith(true)
    expect(mainWindow.setMaximizable).toHaveBeenCalledWith(true)
    expect(mainWindow.setFullScreenable).toHaveBeenCalledWith(true)
    expect(mainWindow.setWindowButtonVisibility).toHaveBeenCalledWith(true)
    expect(mainWindow.setHasShadow).toHaveBeenCalledWith(true)
    expect(mainWindow.setSkipTaskbar).toHaveBeenCalledWith(false)
    expect(mainWindow.setHiddenInMissionControl).toHaveBeenCalledWith(false)
    expect(mainWindow.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(false)
  })

  it('queues settings events until the settings renderer reports ready', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)

    const send = vi.fn()
    ;(presenter as any).settingsWindow = {
      id: 9,
      isDestroyed: vi.fn(() => false),
      webContents: {
        id: 99,
        isDestroyed: vi.fn(() => false),
        send
      }
    }

    expect(
      presenter.sendToWindow(9, SETTINGS_EVENTS.NAVIGATE, {
        routeName: 'settings-deepchat-agents'
      })
    ).toBe(true)
    expect(
      presenter.sendToWindow(9, SETTINGS_EVENTS.NAVIGATE, {
        routeName: 'settings-about'
      })
    ).toBe(true)
    expect(send).not.toHaveBeenCalled()
    expect((presenter as any).pendingSettingsMessages).toHaveLength(2)

    presenter.notifySettingsReady(99)

    expect(send).toHaveBeenNthCalledWith(1, SETTINGS_EVENTS.NAVIGATE, {
      routeName: 'settings-deepchat-agents'
    })
    expect(send).toHaveBeenNthCalledWith(2, SETTINGS_EVENTS.NAVIGATE, {
      routeName: 'settings-about'
    })
    expect((presenter as any).pendingSettingsMessages).toHaveLength(0)
  })

  it('clears queued settings messages when the settings window state resets', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)

    const queuedPreview = {
      kind: 'builtin' as const,
      id: 'deepseek',
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-secret',
      maskedApiKey: 'sk-s...cret',
      iconModelId: 'deepseek-chat',
      willOverwrite: true
    }

    ;(presenter as any).pendingSettingsMessages = [
      { channel: SETTINGS_EVENTS.NAVIGATE, args: [{ routeName: 'settings-about' }] }
    ]
    ;(presenter as any).pendingSettingsProviderInstalls = [queuedPreview]
    ;(presenter as any).settingsWindowReady = true
    ;(presenter as any).resetSettingsWindowState(true)

    expect((presenter as any).settingsWindowReady).toBe(false)
    expect((presenter as any).pendingSettingsMessages).toHaveLength(0)
    expect(queuedPreview.apiKey).toBe('')
    expect((presenter as any).pendingSettingsProviderInstalls).toHaveLength(0)
  })

  it('consumes pending provider installs in FIFO order', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)

    const firstPreview = {
      kind: 'builtin' as const,
      id: 'deepseek',
      baseUrl: 'https://example.com/v1',
      apiKey: 'sk-first',
      maskedApiKey: 'sk-f...irst',
      iconModelId: 'deepseek-chat',
      willOverwrite: true
    }
    const secondPreview = {
      kind: 'custom' as const,
      name: 'DeepSeek Proxy',
      type: 'deepseek',
      baseUrl: 'https://proxy.example.com/v1',
      apiKey: 'sk-second',
      maskedApiKey: 'sk-s...cond',
      iconModelId: 'deepseek-chat'
    }

    presenter.setPendingSettingsProviderInstall(firstPreview)
    presenter.setPendingSettingsProviderInstall(secondPreview)

    expect(presenter.consumePendingSettingsProviderInstall()).toEqual(firstPreview)
    expect(presenter.consumePendingSettingsProviderInstall()).toEqual(secondPreview)
    expect(presenter.consumePendingSettingsProviderInstall()).toBeNull()
  })

  it('keeps the settings window ready during same-document navigation', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)

    ;(presenter as any).settingsWindow = {
      id: 9
    }
    ;(presenter as any).settingsWindowReady = true

    ;(presenter as any).handleSettingsWindowNavigationStart(9, true, true)
    expect((presenter as any).settingsWindowReady).toBe(true)

    ;(presenter as any).handleSettingsWindowNavigationStart(9, true, false)
    expect((presenter as any).settingsWindowReady).toBe(false)
  })

  it('restores the main window only after close-to-hide', async () => {
    const windowHandlers = new Map<string, (...args: any[]) => void>()
    const appWindow = {
      id: 7,
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      on: vi.fn((eventName: string, handler: (...args: any[]) => void) => {
        windowHandlers.set(eventName, handler)
      }),
      once: vi.fn(),
      removeListener: vi.fn(),
      webContents: {
        id: 70,
        send: vi.fn(),
        on: vi.fn(),
        setWindowOpenHandler: vi.fn(),
        setBackgroundThrottling: vi.fn(),
        setFrameRate: vi.fn(),
        openDevTools: vi.fn(),
        isDestroyed: vi.fn(() => false)
      },
      isDestroyed: vi.fn(() => false),
      isFullScreen: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      setFullScreen: vi.fn(),
      setContentProtection: vi.fn(),
      setBackgroundColor: vi.fn(),
      setHiddenInMissionControl: vi.fn(),
      setSkipTaskbar: vi.fn(),
      close: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
      hide: vi.fn(),
      restore: vi.fn()
    }
    vi.mocked(BrowserWindow).mockImplementationOnce(() => appWindow as any)
    ;(BrowserWindow as any).fromId = vi.fn(() => appWindow)

    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false),
      getCloseToQuit: vi.fn(() => false)
    } as any)

    await presenter.createAppWindow({ x: 0, y: 0 })

    expect(presenter.restoreMainWindowHiddenByClose()).toBe(false)

    const preventDefault = vi.fn()
    windowHandlers.get('close')?.({ preventDefault })
    windowHandlers.get('show')?.()

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(appWindow.hide).toHaveBeenCalledOnce()
    expect(presenter.restoreMainWindowHiddenByClose()).toBe(false)

    windowHandlers.get('close')?.({ preventDefault })

    expect(presenter.restoreMainWindowHiddenByClose()).toBe(true)
    expect(appWindow.show).toHaveBeenCalledOnce()
    expect(appWindow.focus).toHaveBeenCalledOnce()
    expect(activateAppOnMacMock).toHaveBeenCalledOnce()
    expect(presenter.restoreMainWindowHiddenByClose()).toBe(false)
  })

  it('sets a minimum size for the settings window', async () => {
    const { WindowPresenter } = await import('@/presenter/windowPresenter')
    const presenter = new WindowPresenter({
      getContentProtectionEnabled: vi.fn(() => false)
    } as any)

    await presenter.createSettingsWindow()

    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        minWidth: 900,
        minHeight: 640
      })
    )
  })
})
