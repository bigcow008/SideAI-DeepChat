import type { Bounds, WindowFollowerMode } from '@shared/windowFollower'
import { calculatePanelBoundsForDisplay } from '@/windowFollower/core/panelBounds'
import type { WindowContextRefreshResult } from '@/windowFollower/windowContextService'

type DisplayLike = {
  bounds: Bounds
  workArea: Bounds
}

type BrowserWindowLike = {
  id: number
  webContents: { id: number }
  getBounds: () => Bounds
  setBounds: (bounds: Bounds) => void
  setAlwaysOnTop: (flag: boolean) => void
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  showInactive: () => void
  show: () => void
  focus: () => void
  isDestroyed: () => boolean
}

type WindowFollowerPresenterDependencies = {
  getWindow: () => BrowserWindowLike | undefined
  getDisplayMatching: (bounds: Bounds) => DisplayLike
  getAllDisplays: () => DisplayLike[]
  refreshContext?: (forcePermissions?: boolean) => Promise<WindowContextRefreshResult>
  suspendWindowStateTracking?: () => void
  resumeWindowStateTracking?: () => void
}

const FOLLOW_POLL_INTERVAL_MS = 80

export class WindowFollowerPresenter {
  #mode: WindowFollowerMode = 'normal'
  #normalBounds: Bounds | null = null
  #lastTargetBounds: Bounds | null = null
  #collapsed = false
  #panelWidth = 360
  #pollTimer: ReturnType<typeof setInterval> | null = null
  #refreshInFlight: Promise<void> | null = null
  #waitForExternalActivation = false

  constructor(private readonly dependencies: WindowFollowerPresenterDependencies) {}

  get mode(): WindowFollowerMode {
    return this.#mode
  }

  get collapsed(): boolean {
    return this.#collapsed
  }

  start() {
    if (this.#pollTimer || !this.dependencies.refreshContext) return
    void this.refresh()
    this.#pollTimer = setInterval(() => void this.refresh(), FOLLOW_POLL_INTERVAL_MS)
  }

  stop() {
    if (this.#pollTimer) clearInterval(this.#pollTimer)
    this.#pollTimer = null
  }

  refresh(forcePermissions = false): Promise<void> {
    if (!this.dependencies.refreshContext) return Promise.resolve()
    if (!this.#refreshInFlight) {
      this.#refreshInFlight = this.runRefresh(forcePermissions).finally(() => {
        this.#refreshInFlight = null
      })
    }
    return this.#refreshInFlight
  }

  followTarget(targetBounds: Bounds): boolean {
    const window = this.resolveWindow()
    if (!window) return false

    if (this.#mode === 'normal') {
      this.#normalBounds = window.getBounds()
      this.dependencies.suspendWindowStateTracking?.()
    }

    this.#mode = 'following'
    this.#lastTargetBounds = { ...targetBounds }
    this.applyFollowBounds(window)
    window.setAlwaysOnTop(true)
    window.showInactive()
    return true
  }

  returnToNormal(shouldFocus = true): boolean {
    const window = this.resolveWindow()
    this.#mode = 'normal'
    this.#collapsed = false
    this.#lastTargetBounds = null
    this.#waitForExternalActivation = true
    if (!window) return false

    window.setAlwaysOnTop(false)
    window.setIgnoreMouseEvents(false)
    if (this.#normalBounds) window.setBounds(this.#normalBounds)
    this.dependencies.resumeWindowStateTracking?.()
    window.show()
    if (shouldFocus) window.focus()
    return true
  }

  setFixed(enabled: boolean): boolean {
    if (!enabled) return this.returnToNormal(false)
    const window = this.resolveWindow()
    if (!window) return false
    if (this.#mode === 'normal') {
      this.#normalBounds = window.getBounds()
      this.dependencies.suspendWindowStateTracking?.()
    }
    this.#mode = 'fixed'
    window.setAlwaysOnTop(true)
    window.setIgnoreMouseEvents(false)
    return true
  }

  setDetached(enabled: boolean): boolean {
    if (!enabled) return this.returnToNormal(false)
    const window = this.resolveWindow()
    if (!window) return false
    if (this.#mode === 'normal') {
      this.#normalBounds = window.getBounds()
      this.dependencies.suspendWindowStateTracking?.()
    }
    this.#mode = 'detached'
    window.setAlwaysOnTop(false)
    window.setIgnoreMouseEvents(false)
    return true
  }

  setCollapsed(collapsed: boolean): boolean {
    const window = this.resolveWindow()
    if (!window) return false
    this.#collapsed = collapsed

    if (this.#mode === 'following' && this.#lastTargetBounds) {
      this.applyFollowBounds(window)
    }
    return true
  }

  setPanelWidth(width: number): boolean {
    if (!Number.isFinite(width)) return false
    this.#panelWidth = width
    const window = this.resolveWindow()
    if (window && this.#mode === 'following' && this.#lastTargetBounds) {
      this.applyFollowBounds(window)
    }
    return true
  }

  private resolveWindow() {
    const window = this.dependencies.getWindow()
    return window && !window.isDestroyed() ? window : undefined
  }

  private applyFollowBounds(window: BrowserWindowLike) {
    const targetBounds = this.#lastTargetBounds!
    const display = this.dependencies.getDisplayMatching(targetBounds)
    const result = calculatePanelBoundsForDisplay({
      targetBounds,
      display,
      displays: this.dependencies.getAllDisplays(),
      userCollapsed: this.#collapsed,
      panelWidth: this.#panelWidth,
      constrainWindowToVisibleReserve: true
    })
    window.setBounds(result.bounds)
    window.setIgnoreMouseEvents(false)
  }

  private async runRefresh(forcePermissions: boolean) {
    const result = await this.dependencies.refreshContext!(forcePermissions)
    if (!result.automaticAdhesionAvailable) {
      if (this.#mode === 'following') this.returnToNormal(false)
      return
    }

    const snapshot = result.snapshot
    if (!snapshot) return

    if (snapshot.source === 'active') {
      this.#waitForExternalActivation = false
      if (this.#mode === 'normal' || this.#mode === 'following') {
        this.followTarget(snapshot.window.bounds)
      }
      return
    }

    if (
      snapshot.source === 'retained-while-sideai-focused' &&
      this.#mode === 'following' &&
      !this.#waitForExternalActivation
    ) {
      this.followTarget(snapshot.window.bounds)
    }
  }
}
