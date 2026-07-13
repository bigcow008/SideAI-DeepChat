import { describe, expect, it, vi } from 'vitest'
import { dispatchWindowFollowerRoute } from '@/routes/windowFollowerRoutes'

const state = {
  mode: 'normal' as const,
  collapsed: false,
  panelWidth: 360,
  automaticAdhesionAvailable: false,
  snapshot: null,
  permissions: {
    platform: 'macos' as const,
    accessibility: 'granted' as const,
    screenRecording: 'granted' as const,
    checkedAt: 1_000
  },
  panelBounds: null,
  displayBounds: [],
  placement: null,
  contentOffsetX: 0,
  lastError: null,
  updatedAt: 1_000
}

const settings = {
  automaticAdhesion: true,
  currentApp: {
    id: 'bundleId:com.microsoft.VSCode',
    matchType: 'bundleId' as const,
    name: 'Code',
    bundleId: 'com.microsoft.VSCode',
    path: '/Applications/Visual Studio Code.app'
  },
  excludedApps: []
}

function runtime() {
  return {
    windowFollowerPresenter: {
      getDebugState: vi.fn(() => state),
      refresh: vi.fn(async () => {}),
      setMode: vi.fn(),
      setCollapsed: vi.fn(),
      setPanelWidth: vi.fn(),
      setContentPointerInteractive: vi.fn(),
      resetPanelWidth: vi.fn(() => true),
      getSettings: vi.fn(() => settings),
      excludeCurrentApp: vi.fn(async () => settings),
      removeExcludedApp: vi.fn(async () => settings),
      hide: vi.fn(() => true),
      quit: vi.fn(() => true)
    },
    desktopPermissionService: {
      openSettings: vi.fn(async () => ({ value: state.permissions, revision: 1 }))
    },
    getAutomaticAdhesion: vi.fn(() => true),
    setAutomaticAdhesion: vi.fn()
  }
}

describe('window follower route handler', () => {
  it('dispatches typed mode changes and returns debug state', async () => {
    const target = runtime()
    await expect(
      dispatchWindowFollowerRoute(target, 'windowFollower.setMode', { mode: 'fixed' })
    ).resolves.toEqual({ state })
    expect(target.windowFollowerPresenter.setMode).toHaveBeenCalledWith('fixed')
  })

  it('persists the automatic adhesion preference and refreshes immediately', async () => {
    const target = runtime()
    await dispatchWindowFollowerRoute(target, 'windowFollower.setAutomaticAdhesion', {
      enabled: false
    })
    expect(target.setAutomaticAdhesion).toHaveBeenCalledWith(false)
    expect(target.windowFollowerPresenter.refresh).toHaveBeenCalledWith(true)
  })

  it('opens macOS permission settings and forces a presenter refresh', async () => {
    const target = runtime()
    await dispatchWindowFollowerRoute(target, 'windowFollower.openPermissionSettings', {
      permission: 'screenRecording'
    })
    expect(target.desktopPermissionService.openSettings).toHaveBeenCalledWith('screenRecording')
    expect(target.windowFollowerPresenter.refresh).toHaveBeenCalledWith(true)
  })

  it('dispatches the complete typed container command set', async () => {
    const target = runtime()

    await expect(
      dispatchWindowFollowerRoute(target, 'windowFollower.resetWidth', {})
    ).resolves.toEqual({ state })
    await expect(
      dispatchWindowFollowerRoute(target, 'windowFollower.getSettings', {})
    ).resolves.toEqual({ settings })
    await expect(
      dispatchWindowFollowerRoute(target, 'windowFollower.excludeCurrentApp', {})
    ).resolves.toEqual({ settings, state })
    await expect(
      dispatchWindowFollowerRoute(target, 'windowFollower.removeExcludedApp', {
        id: 'bundleId:com.microsoft.VSCode'
      })
    ).resolves.toEqual({ settings, state })
    await expect(dispatchWindowFollowerRoute(target, 'windowFollower.hide', {})).resolves.toEqual({
      hidden: true
    })
    await expect(dispatchWindowFollowerRoute(target, 'windowFollower.quit', {})).resolves.toEqual({
      requested: true
    })

    expect(target.windowFollowerPresenter.resetPanelWidth).toHaveBeenCalledOnce()
    expect(target.windowFollowerPresenter.excludeCurrentApp).toHaveBeenCalledOnce()
    expect(target.windowFollowerPresenter.removeExcludedApp).toHaveBeenCalledWith(
      'bundleId:com.microsoft.VSCode'
    )
    expect(target.windowFollowerPresenter.hide).toHaveBeenCalledOnce()
    expect(target.windowFollowerPresenter.quit).toHaveBeenCalledOnce()
  })
})
