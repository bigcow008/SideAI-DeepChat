import type {
  Bounds,
  WindowContextSnapshot,
  WindowFollowerDebugDto,
  WindowFollowerMode
} from '@shared/windowFollower'
import {
  calculatePanelBoundsForDisplay,
  type PanelBoundsResult
} from '@/windowFollower/core/panelBounds'
import type { WindowContextRefreshResult } from '@/windowFollower/windowContextService'
import { decidePanelMousePassthrough } from '@/windowFollower/core/panelMousePassthrough'

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
  onStateChanged?: (state: WindowFollowerDebugDto) => void
}

const FOLLOW_POLL_INTERVAL_MS = 80

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}

export class WindowFollowerPresenter {
  #mode: WindowFollowerMode = 'normal'
  #normalBounds: Bounds | null = null
  #lastTargetBounds: Bounds | null = null
  #collapsed = false
  #panelWidth = 360
  #pollTimer: ReturnType<typeof setInterval> | null = null
  #refreshInFlight: Promise<void> | null = null
  #refreshInFlightForcesPermissions = false
  #waitForExternalActivation = false
  #lastRefreshResult: WindowContextRefreshResult | null = null
  #lastPanelResult: PanelBoundsResult | null = null
  #contentPointerInteractive = false
  #lastPublishedSignature: string | null = null
  #updatedAt = 0

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
    if (this.#refreshInFlight) {
      if (!forcePermissions || this.#refreshInFlightForcesPermissions) {
        return this.#refreshInFlight
      }
      return this.#refreshInFlight.then(
        () => this.refresh(true),
        () => this.refresh(true)
      )
    }

    this.#refreshInFlightForcesPermissions = forcePermissions
    const refresh = this.runRefresh(forcePermissions).finally(() => {
      if (this.#refreshInFlight === refresh) {
        this.#refreshInFlight = null
        this.#refreshInFlightForcesPermissions = false
      }
    })
    this.#refreshInFlight = refresh
    return refresh
  }

  async captureWindowContextForMessage(): Promise<WindowContextSnapshot | null> {
    const wasFollowing = this.#mode === 'following'
    try {
      await this.refresh(true)
    } catch {
      return null
    }

    const result = this.#lastRefreshResult
    if (
      !wasFollowing ||
      this.#mode !== 'following' ||
      !result?.automaticAdhesionAvailable ||
      !result.snapshot ||
      (result.snapshot.freshness !== 'live' && result.snapshot.freshness !== 'retained')
    ) {
      return null
    }

    return deepFreeze(structuredClone(result.snapshot))
  }

  getDebugState(): WindowFollowerDebugDto {
    const window = this.resolveWindow()
    return {
      mode: this.#mode,
      collapsed: this.#collapsed,
      panelWidth: this.#panelWidth,
      automaticAdhesionAvailable:
        this.#lastRefreshResult?.automaticAdhesionAvailable ?? false,
      snapshot: this.#lastRefreshResult?.snapshot ?? null,
      permissions: this.#lastRefreshResult?.permissions ?? {
        platform: 'unknown',
        accessibility: 'unknown',
        screenRecording: 'unknown',
        checkedAt: 0
      },
      panelBounds: this.#mode === 'normal' || !window ? null : window.getBounds(),
      displayBounds: this.dependencies.getAllDisplays().map((display) => ({ ...display.bounds })),
      placement: this.#lastPanelResult?.placement ?? null,
      contentOffsetX: this.#lastPanelResult?.contentOffsetX ?? 0,
      lastError: this.#lastRefreshResult?.lastError ?? null,
      updatedAt: this.#updatedAt
    }
  }

  setMode(mode: WindowFollowerMode): boolean {
    if (mode === 'normal') return this.returnToNormal(true)
    if (mode === 'fixed') return this.setFixed(true)
    if (mode === 'detached') return this.setDetached(true)
    void this.refresh(true)
    return true
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
    this.publishStateIfChanged()
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
    this.publishStateIfChanged()
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
    this.publishStateIfChanged()
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
    this.publishStateIfChanged()
    return true
  }

  setCollapsed(collapsed: boolean): boolean {
    const window = this.resolveWindow()
    if (!window) return false
    this.#collapsed = collapsed

    if (this.#mode === 'following' && this.#lastTargetBounds) {
      this.applyFollowBounds(window)
    }
    this.publishStateIfChanged()
    return true
  }

  setPanelWidth(width: number): boolean {
    if (!Number.isFinite(width)) return false
    this.#panelWidth = width
    const window = this.resolveWindow()
    if (window && this.#mode === 'following' && this.#lastTargetBounds) {
      this.applyFollowBounds(window)
    }
    this.publishStateIfChanged()
    return true
  }

  setContentPointerInteractive(interactive: boolean): boolean {
    this.#contentPointerInteractive = interactive
    const window = this.resolveWindow()
    if (!window) return false
    this.applyMousePassthrough(window)
    this.publishStateIfChanged()
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
    this.#lastPanelResult = result
    window.setBounds(result.bounds)
    this.applyMousePassthrough(window)
  }

  private applyMousePassthrough(window: BrowserWindowLike) {
    const decision = decidePanelMousePassthrough({
      hasTransparentReserve: (this.#lastPanelResult?.contentOffsetX ?? 0) > 0,
      contentPointerInteractive: this.#contentPointerInteractive
    })
    window.setIgnoreMouseEvents(
      decision.ignoreMouseEvents,
      decision.forward ? { forward: true } : undefined
    )
  }

  private async runRefresh(forcePermissions: boolean) {
    const result = await this.dependencies.refreshContext!(forcePermissions)
    this.#lastRefreshResult = result
    if (!result.automaticAdhesionAvailable) {
      if (this.#mode === 'following') this.returnToNormal(false)
      this.publishStateIfChanged()
      return
    }

    const snapshot = result.snapshot
    if (!snapshot) {
      this.publishStateIfChanged()
      return
    }

    if (snapshot.source === 'active') {
      this.#waitForExternalActivation = false
      if (this.#mode === 'normal' || this.#mode === 'following') {
        this.followTarget(snapshot.window.bounds)
      }
      this.publishStateIfChanged()
      return
    }

    if (
      snapshot.source === 'retained-while-sideai-focused' &&
      this.#mode === 'following' &&
      !this.#waitForExternalActivation
    ) {
      this.followTarget(snapshot.window.bounds)
    }
    this.publishStateIfChanged()
  }

  private publishStateIfChanged() {
    if (!this.dependencies.onStateChanged) return
    const state = this.getDebugState()
    const signature = JSON.stringify({ ...state, updatedAt: 0 })
    if (signature === this.#lastPublishedSignature) return
    this.#lastPublishedSignature = signature
    this.#updatedAt = Date.now()
    this.dependencies.onStateChanged({ ...state, updatedAt: this.#updatedAt })
  }
}
