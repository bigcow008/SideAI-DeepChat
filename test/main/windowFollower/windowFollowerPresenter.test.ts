import { describe, expect, it, vi } from 'vitest'
import { WindowFollowerPresenter } from '@/presenter/windowFollowerPresenter'

function createWindow() {
  let bounds = { x: 100, y: 80, width: 1000, height: 760 }
  return {
    id: 7,
    webContents: { id: 70 },
    getBounds: vi.fn(() => ({ ...bounds })),
    setBounds: vi.fn((next) => {
      bounds = { ...next }
    }),
    setAlwaysOnTop: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    showInactive: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn(() => false)
  }
}

const primary = {
  bounds: { x: 0, y: 0, width: 1728, height: 1117 },
  workArea: { x: 0, y: 0, width: 1728, height: 1080 }
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
})
