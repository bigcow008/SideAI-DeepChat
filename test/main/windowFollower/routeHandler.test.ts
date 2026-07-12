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

function runtime() {
  return {
    windowFollowerPresenter: {
      getDebugState: vi.fn(() => state),
      refresh: vi.fn(async () => {}),
      setMode: vi.fn(),
      setCollapsed: vi.fn(),
      setPanelWidth: vi.fn(),
      setContentPointerInteractive: vi.fn()
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
})
