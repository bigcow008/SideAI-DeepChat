import { describe, expect, it, vi } from 'vitest'
import { WindowFollowerPresenter } from '@/presenter/windowFollowerPresenter'
import type { WindowContextSnapshot, WindowFollowerSettingsDto } from '@shared/windowFollower'

function createWindow() {
  let bounds = { x: 100, y: 80, width: 1000, height: 760 }
  const listeners = new Map<string, Set<() => void>>()
  const window = {
    id: 7,
    webContents: { id: 70 },
    getBounds: vi.fn(() => ({ ...bounds })),
    setBounds: vi.fn((next) => {
      bounds = { ...next }
    }),
    setPosition: vi.fn((x: number, y: number) => {
      bounds = { ...bounds, x, y }
    }),
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    showInactive: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn(() => false),
    on: vi.fn((event: string, listener: () => void) => {
      const eventListeners = listeners.get(event) ?? new Set()
      eventListeners.add(listener)
      listeners.set(event, eventListeners)
      return window
    }),
    removeListener: vi.fn((event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener)
      return window
    }),
    moveTo(next: { x: number; y: number; width: number; height: number }) {
      bounds = { ...next }
      listeners.get('move')?.forEach((listener) => listener())
    }
  }
  return window
}

const primary = {
  bounds: { x: 0, y: 0, width: 1728, height: 1117 },
  workArea: { x: 0, y: 0, width: 1728, height: 1080 }
}

const settings: WindowFollowerSettingsDto = {
  automaticAdhesion: true,
  currentApp: {
    id: 'bundleId:com.microsoft.VSCode',
    matchType: 'bundleId',
    name: 'Code',
    bundleId: 'com.microsoft.VSCode'
  },
  excludedApps: []
}

const grantedPermissions = {
  platform: 'macos' as const,
  accessibility: 'granted' as const,
  screenRecording: 'granted' as const,
  checkedAt: 1_000
}

describe('WindowFollowerPresenter', () => {
  it('switches the same BrowserWindow to a non-activating attached panel and back', () => {
    const window = createWindow()
    const webContentsId = window.webContents.id
    const suspendWindowStateTracking = vi.fn()
    const resumeWindowStateTracking = vi.fn()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      suspendWindowStateTracking,
      resumeWindowStateTracking
    })

    presenter.followTarget({ x: 0, y: 0, width: 1200, height: 800 })

    expect(presenter.mode).toBe('following')
    expect(window.showInactive).toHaveBeenCalledOnce()
    expect(suspendWindowStateTracking).toHaveBeenCalledOnce()
    expect(window.focus).not.toHaveBeenCalled()
    expect(window.webContents.id).toBe(webContentsId)

    presenter.returnToNormal(true)

    expect(presenter.mode).toBe('normal')
    expect(window.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 80, width: 1000, height: 760 })
    expect(window.show).toHaveBeenCalledOnce()
    expect(window.focus).toHaveBeenCalledOnce()
    expect(resumeWindowStateTracking).toHaveBeenCalledOnce()
    expect(window.webContents.id).toBe(webContentsId)
  })

  it('keeps fixed and detached modes stationary with distinct always-on-top policy', () => {
    const window = createWindow()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary]
    })

    presenter.setFixed(true)
    expect(presenter.mode).toBe('fixed')
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(true)

    presenter.setDetached(true)
    expect(presenter.mode).toBe('detached')
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(false)
  })

  it.each(['fixed', 'detached'] as const)('resumes following from %s mode', async (mode) => {
    const window = createWindow()
    const targetBounds = { x: 100, y: 100, width: 900, height: 700 }
    const refreshContext = vi.fn(async () => ({
      permissions: grantedPermissions,
      canReadWindowContext: true,
      automaticAdhesionAvailable: true,
      snapshot: {
        source: 'retained-while-sideai-focused' as const,
        freshness: 'retained' as const,
        window: { bounds: targetBounds }
      },
      lastError: null
    }))
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })
    presenter.followTarget(targetBounds)
    mode === 'fixed' ? presenter.setFixed(true) : presenter.setDetached(true)

    expect(presenter.setMode('following')).toBe(true)
    expect(presenter.mode).toBe('following')
    expect(window.showInactive).toHaveBeenCalledTimes(2)
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(true)

    await presenter.refresh()
    expect(presenter.mode).toBe('following')
  })

  it('collapses and expands the native window without replacing it', () => {
    const window = createWindow()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary]
    })
    presenter.followTarget({ x: 100, y: 100, width: 900, height: 700 })

    presenter.setCollapsed(true)
    expect(window.setBounds).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 36, height: 36 })
    )

    presenter.setCollapsed(false)
    expect(window.setBounds).toHaveBeenLastCalledWith(
      expect.objectContaining({ width: 360, height: 700 })
    )
    expect(window.id).toBe(7)
  })

  it('expands a fixed collapsed bubble at its user-dragged position', () => {
    const window = createWindow()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary]
    })
    presenter.followTarget({ x: 100, y: 100, width: 900, height: 700 })
    presenter.setFixed(true)
    presenter.setCollapsed(true)

    window.moveTo({ x: 1320, y: 240, width: 36, height: 36 })
    presenter.setPanelWidth(480)
    presenter.setCollapsed(false)

    expect(window.getBounds()).toEqual({ x: 1320, y: 240, width: 480, height: 700 })
  })

  it('keeps a display-constrained followed panel stationary without shifting', () => {
    const window = createWindow()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary]
    })
    presenter.followTarget({ x: 0, y: 0, width: 1728, height: 1080 })

    expect(window.getBounds()).toEqual({ x: 1368, y: 0, width: 360, height: 1080 })

    presenter.setFixed(true)

    expect(window.getBounds()).toEqual({ x: 1368, y: 0, width: 360, height: 1080 })
    expect(presenter.getDebugState().contentOffsetX).toBe(0)
  })

  it('switches native chrome for the same window between desktop and panel modes', () => {
    const window = createWindow()
    const enterPanelWindowPresentation = vi.fn()
    const restoreDesktopWindowPresentation = vi.fn()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      enterPanelWindowPresentation,
      restoreDesktopWindowPresentation
    })

    presenter.followTarget({ x: 100, y: 100, width: 900, height: 700 })

    expect(enterPanelWindowPresentation).toHaveBeenLastCalledWith({
      collapsed: false,
      hasTransparentReserve: false
    })

    presenter.returnToNormal(true)

    expect(restoreDesktopWindowPresentation).toHaveBeenCalledOnce()
    expect(window.webContents.id).toBe(70)
  })

  it('automatically follows live external targets without bouncing back on retained self focus', async () => {
    const window = createWindow()
    const refreshContext = vi
      .fn()
      .mockResolvedValueOnce({
        automaticAdhesionAvailable: true,
        snapshot: {
          source: 'active',
          freshness: 'live',
          window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
        }
      })
      .mockResolvedValueOnce({
        automaticAdhesionAvailable: true,
        snapshot: {
          source: 'retained-while-sideai-focused',
          freshness: 'retained',
          window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
        }
      })
      .mockResolvedValueOnce({
        automaticAdhesionAvailable: true,
        snapshot: {
          source: 'active',
          freshness: 'live',
          window: { bounds: { x: 200, y: 120, width: 1000, height: 720 } }
        }
      })
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })

    await presenter.refresh()
    expect(presenter.mode).toBe('following')

    presenter.returnToNormal(true)
    await presenter.refresh()
    expect(presenter.mode).toBe('normal')

    await presenter.refresh()
    expect(presenter.mode).toBe('following')
  })

  it('returns to normal when required desktop permissions are revoked', async () => {
    const window = createWindow()
    const refreshContext = vi
      .fn()
      .mockResolvedValueOnce({
        automaticAdhesionAvailable: true,
        snapshot: {
          source: 'active',
          freshness: 'live',
          window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
        }
      })
      .mockResolvedValueOnce({ automaticAdhesionAvailable: false, snapshot: null })
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })

    await presenter.refresh()
    await presenter.refresh()

    expect(presenter.mode).toBe('normal')
    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(false)
  })

  it('publishes typed debug state only when observable state changes', async () => {
    const window = createWindow()
    const result = {
      permissions: {
        platform: 'macos' as const,
        accessibility: 'granted' as const,
        screenRecording: 'granted' as const,
        checkedAt: 1_000
      },
      canReadWindowContext: true,
      automaticAdhesionAvailable: false,
      snapshot: null,
      lastError: null
    }
    const onStateChanged = vi.fn()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext: vi.fn(async () => result),
      onStateChanged
    })

    await presenter.refresh()
    await presenter.refresh()

    expect(onStateChanged).toHaveBeenCalledOnce()
    expect(onStateChanged).toHaveBeenCalledWith(expect.objectContaining({ mode: 'normal' }))
  })

  it('force-refreshes permissions and returns context only while following', async () => {
    const window = createWindow()
    const snapshot: WindowContextSnapshot = {
      schemaVersion: 1,
      trackingState: 'following',
      source: 'active',
      freshness: 'live',
      capturedAt: 1_000,
      lastVerifiedAt: 1_000,
      app: {
        stableKey: 'bundleId:com.microsoft.VSCode',
        name: 'Code',
        bundleId: 'com.microsoft.VSCode',
        path: '/Applications/Visual Studio Code.app',
        processId: 42
      },
      window: {
        windowId: 7,
        title: 'PRD.md - SideAI',
        bounds: { x: 100, y: 100, width: 900, height: 700 }
      },
      permissions: {
        platform: 'macos',
        accessibility: 'granted',
        screenRecording: 'granted',
        checkedAt: 1_000
      }
    }
    const refreshContext = vi.fn(async () => ({
      permissions: snapshot.permissions,
      canReadWindowContext: true,
      automaticAdhesionAvailable: true,
      snapshot,
      lastError: null
    }))
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })

    expect(await presenter.captureWindowContextForMessage()).toBeNull()
    presenter.followTarget(snapshot.window.bounds)
    const captured = await presenter.captureWindowContextForMessage()

    expect(captured).toEqual(snapshot)
    expect(captured).not.toBe(snapshot)
    expect(Object.isFrozen(captured)).toBe(true)
    expect(Object.isFrozen(captured?.window.bounds)).toBe(true)
    expect(refreshContext).toHaveBeenLastCalledWith(true)
  })

  it('does not attach context when a forced refresh only then enters following mode', async () => {
    const window = createWindow()
    const snapshot = {
      source: 'active' as const,
      freshness: 'live' as const,
      window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
    }
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext: vi.fn(async () => ({
        automaticAdhesionAvailable: true,
        snapshot
      }))
    })

    expect(await presenter.captureWindowContextForMessage()).toBeNull()
    expect(presenter.mode).toBe('following')
  })

  it('runs a forced permission refresh after an ordinary refresh already in flight', async () => {
    const window = createWindow()
    let releaseOrdinaryRefresh: (() => void) | undefined
    const ordinaryRefresh = new Promise<void>((resolve) => {
      releaseOrdinaryRefresh = resolve
    })
    const result = {
      automaticAdhesionAvailable: true,
      snapshot: {
        source: 'active' as const,
        freshness: 'live' as const,
        window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
      }
    }
    const refreshContext = vi
      .fn()
      .mockImplementationOnce(async () => {
        await ordinaryRefresh
        return result
      })
      .mockResolvedValueOnce(result)
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })
    presenter.followTarget(result.snapshot.window.bounds)

    const backgroundRefresh = presenter.refresh(false)
    const capture = presenter.captureWindowContextForMessage()
    releaseOrdinaryRefresh?.()
    await backgroundRefresh
    await capture

    expect(refreshContext.mock.calls.map(([force]) => force)).toEqual([false, true])
  })

  it('runs a forced permission refresh after an ordinary in-flight refresh rejects', async () => {
    const window = createWindow()
    const result = {
      automaticAdhesionAvailable: true,
      snapshot: {
        source: 'active' as const,
        freshness: 'live' as const,
        window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
      }
    }
    const refreshContext = vi
      .fn()
      .mockRejectedValueOnce(new Error('ordinary refresh failed'))
      .mockResolvedValueOnce(result)
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })
    presenter.followTarget(result.snapshot.window.bounds)

    const backgroundRefresh = presenter.refresh(false)
    const capture = presenter.captureWindowContextForMessage()

    await expect(backgroundRefresh).rejects.toThrow('ordinary refresh failed')
    await expect(capture).resolves.not.toBeNull()
    expect(refreshContext.mock.calls.map(([force]) => force)).toEqual([false, true])
  })

  it.each(['fixed', 'detached'] as const)('does not attach context in %s mode', async (mode) => {
    const window = createWindow()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext: vi.fn(async () => ({
        automaticAdhesionAvailable: true,
        snapshot: {
          source: 'active' as const,
          freshness: 'live' as const,
          window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
        }
      }))
    })

    mode === 'fixed' ? presenter.setFixed(true) : presenter.setDetached(true)

    expect(await presenter.captureWindowContextForMessage()).toBeNull()
  })

  it('does not attach grace or unavailable targets while following', async () => {
    const window = createWindow()
    const refreshContext = vi
      .fn()
      .mockResolvedValueOnce({
        automaticAdhesionAvailable: true,
        snapshot: {
          source: 'last-known' as const,
          freshness: 'grace' as const,
          window: { bounds: { x: 100, y: 100, width: 900, height: 700 } }
        }
      })
      .mockResolvedValueOnce({ automaticAdhesionAvailable: true, snapshot: null })
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })
    presenter.followTarget({ x: 100, y: 100, width: 900, height: 700 })

    expect(await presenter.captureWindowContextForMessage()).toBeNull()
    expect(await presenter.captureWindowContextForMessage()).toBeNull()
  })

  it('does not block message sending when the forced context refresh fails', async () => {
    const window = createWindow()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext: vi.fn(async () => {
        throw new Error('window read failed')
      })
    })
    presenter.followTarget({ x: 100, y: 100, width: 900, height: 700 })

    await expect(presenter.captureWindowContextForMessage()).resolves.toBeNull()
  })

  it('resets the panel to the accepted SideAI default width', () => {
    const presenter = new WindowFollowerPresenter({
      getWindow: () => createWindow(),
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary]
    })
    presenter.setPanelWidth(480)

    expect(presenter.resetPanelWidth()).toBe(true)
    expect(presenter.getDebugState().panelWidth).toBe(360)
  })

  it('delegates settings and exclusion operations before refreshing native state', async () => {
    const getSettings = vi.fn(() => settings)
    const excludeCurrentApp = vi.fn(async () => settings)
    const removeExcludedApp = vi.fn(async () => settings)
    const refreshContext = vi.fn(async () => ({
      permissions: grantedPermissions,
      canReadWindowContext: true,
      automaticAdhesionAvailable: true,
      snapshot: null,
      lastError: '目标应用已排除'
    }))
    const presenter = new WindowFollowerPresenter({
      getWindow: () => createWindow(),
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext,
      getSettings,
      excludeCurrentApp,
      removeExcludedApp
    })

    expect(presenter.getSettings()).toBe(settings)
    await expect(presenter.excludeCurrentApp()).resolves.toBe(settings)
    await expect(presenter.removeExcludedApp('bundleId:com.microsoft.VSCode')).resolves.toBe(
      settings
    )

    expect(excludeCurrentApp).toHaveBeenCalledOnce()
    expect(removeExcludedApp).toHaveBeenCalledWith('bundleId:com.microsoft.VSCode')
    expect(refreshContext).toHaveBeenCalledTimes(2)
    expect(presenter.getDebugState().lastError).toBe('目标应用已排除')
  })

  it('hides an excluded target and shows again for the next allowed target', async () => {
    const window = createWindow()
    const targetBounds = { x: 100, y: 100, width: 900, height: 700 }
    const refreshContext = vi
      .fn()
      .mockResolvedValueOnce({
        permissions: grantedPermissions,
        canReadWindowContext: true,
        automaticAdhesionAvailable: true,
        snapshot: null,
        targetExcluded: true,
        lastError: '目标应用已排除'
      })
      .mockResolvedValueOnce({
        permissions: grantedPermissions,
        canReadWindowContext: true,
        automaticAdhesionAvailable: true,
        snapshot: {
          source: 'active' as const,
          freshness: 'live' as const,
          window: { bounds: targetBounds }
        },
        targetExcluded: false,
        lastError: null
      })
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })
    presenter.followTarget(targetBounds)

    await presenter.refresh()
    expect(window.hide).toHaveBeenCalledOnce()

    await presenter.refresh()
    expect(window.showInactive).toHaveBeenCalledTimes(2)
  })

  it('hides only the primary window and requests quit through the lifecycle callback', () => {
    const window = createWindow()
    const requestQuit = vi.fn()
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      requestQuit
    })

    expect(presenter.hide()).toBe(true)
    expect(presenter.quit()).toBe(true)

    expect(window.hide).toHaveBeenCalledOnce()
    expect(requestQuit).toHaveBeenCalledOnce()
  })

  it('keeps an explicitly hidden panel hidden until normal mode restores it', async () => {
    const window = createWindow()
    const targetBounds = { x: 100, y: 100, width: 900, height: 700 }
    const refreshContext = vi.fn(async () => ({
      permissions: grantedPermissions,
      canReadWindowContext: true,
      automaticAdhesionAvailable: true,
      snapshot: {
        source: 'active' as const,
        freshness: 'live' as const,
        window: { bounds: targetBounds }
      },
      targetExcluded: false,
      lastError: null
    }))
    const presenter = new WindowFollowerPresenter({
      getWindow: () => window,
      getDisplayMatching: () => primary,
      getAllDisplays: () => [primary],
      refreshContext
    })
    presenter.followTarget(targetBounds)
    presenter.hide()

    await presenter.refresh()

    expect(window.hide).toHaveBeenCalledOnce()
    expect(window.showInactive).toHaveBeenCalledOnce()

    presenter.returnToNormal(true)
    expect(window.show).toHaveBeenCalledOnce()
  })
})
