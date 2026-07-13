import type {
  Bounds,
  WindowContextSnapshot,
  WindowFollowerDebugDto,
  WindowFollowerMode,
  WindowFollowerSettingsDto
} from '@shared/windowFollower'
import {
  calculatePanelBoundsForDisplay,
  PANEL_WIDTH,
  type PanelBoundsResult
} from '@/windowFollower/core/panelBounds'
import type { WindowContextRefreshResult } from '@/windowFollower/windowContextService'
import { decidePanelMousePassthrough } from '@/windowFollower/core/panelMousePassthrough'
import { normalizePanelWidth } from '@/windowFollower/core/panelBounds'
import {
  calculateStationaryPanelBounds,
  captureStationaryExpandedBounds,
  coordinatePanelNativeMove
} from '@/windowFollower/core/panelPresentationBounds'

type DisplayLike = {
  bounds: Bounds
  workArea: Bounds
}

type BrowserWindowLike = {
  id: number
  webContents: { id: number }
  getBounds: () => Bounds
  setBounds: (bounds: Bounds) => void
  setPosition: (x: number, y: number) => void
  setAlwaysOnTop: (flag: boolean) => void
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void
  showInactive: () => void
  show: () => void
  hide: () => void
  focus: () => void
  isDestroyed: () => boolean
  on: (event: 'move', listener: () => void) => unknown
  removeListener: (event: 'move', listener: () => void) => unknown
}

type WindowFollowerPresenterDependencies = {
  getWindow: () => BrowserWindowLike | undefined
  getDisplayMatching: (bounds: Bounds) => DisplayLike
  getAllDisplays: () => DisplayLike[]
  refreshContext?: (forcePermissions?: boolean) => Promise<WindowContextRefreshResult>
  suspendWindowStateTracking?: () => void
  resumeWindowStateTracking?: () => void
  enterPanelWindowPresentation?: (options: {
    collapsed: boolean
    hasTransparentReserve: boolean
  }) => void
  restoreDesktopWindowPresentation?: () => void
  getSettings?: () => WindowFollowerSettingsDto
  excludeCurrentApp?: () => Promise<WindowFollowerSettingsDto>
  removeExcludedApp?: (id: string) => Promise<WindowFollowerSettingsDto>
  requestQuit?: () => void
  onStateChanged?: (state: WindowFollowerDebugDto) => void
}

const FOLLOW_POLL_INTERVAL_MS = 80

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}

function sameBounds(first: Bounds | null, second: Bounds | null) {
  return Boolean(
    first &&
    second &&
    first.x === second.x &&
    first.y === second.y &&
    first.width === second.width &&
    first.height === second.height
  )
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
  #hidden = false
  #lastRefreshResult: WindowContextRefreshResult | null = null
  #lastPanelResult: PanelBoundsResult | null = null
  #contentOffsetX = 0
  #contentPointerInteractive = false
  #lastAppliedBounds: Bounds | null = null
  #desiredBounds: Bounds | null = null
  #stationaryExpandedBounds: Bounds | null = null
  #expectedProgrammaticBounds: Bounds | null = null
  #observedWindow: BrowserWindowLike | null = null
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
    this.detachWindowMoveListener()
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
      automaticAdhesionAvailable: this.#lastRefreshResult?.automaticAdhesionAvailable ?? false,
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
      contentOffsetX: this.#contentOffsetX,
      lastError: this.#lastRefreshResult?.lastError ?? null,
      updatedAt: this.#updatedAt
    }
  }

  setMode(mode: WindowFollowerMode): boolean {
    if (mode === 'normal') return this.returnToNormal(true)
    if (mode === 'fixed') return this.setFixed(true)
    if (mode === 'detached') return this.setDetached(true)
    return this.setFollowing()
  }

  setFollowing(): boolean {
    const window = this.resolveWindow()
    if (!window) return false

    this.#mode = 'following'
    this.#stationaryExpandedBounds = null
    window.setAlwaysOnTop(true)
    if (this.#lastTargetBounds) {
      this.applyFollowBounds(window)
      if (!this.#hidden) window.showInactive()
    } else {
      void this.refresh(true)
    }
    this.publishStateIfChanged()
    return true
  }

  followTarget(targetBounds: Bounds): boolean {
    const window = this.resolveWindow()
    if (!window) return false

    if (this.#mode === 'normal') {
      this.#normalBounds = window.getBounds()
      this.dependencies.suspendWindowStateTracking?.()
      this.dependencies.enterPanelWindowPresentation?.({
        collapsed: this.#collapsed,
        hasTransparentReserve: false
      })
    }

    this.#mode = 'following'
    this.#stationaryExpandedBounds = null
    this.#lastTargetBounds = { ...targetBounds }
    this.applyFollowBounds(window)
    window.setAlwaysOnTop(true)
    if (!this.#hidden) window.showInactive()
    this.publishStateIfChanged()
    return true
  }

  returnToNormal(shouldFocus = true): boolean {
    const window = this.resolveWindow()
    this.#mode = 'normal'
    this.#collapsed = false
    this.#lastTargetBounds = null
    this.#contentOffsetX = 0
    this.#lastPanelResult = null
    this.#lastAppliedBounds = null
    this.#desiredBounds = null
    this.#stationaryExpandedBounds = null
    this.#expectedProgrammaticBounds = null
    this.#waitForExternalActivation = true
    this.#hidden = false
    if (!window) return false

    window.setAlwaysOnTop(false)
    window.setIgnoreMouseEvents(false)
    this.dependencies.restoreDesktopWindowPresentation?.()
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
      this.dependencies.enterPanelWindowPresentation?.({
        collapsed: this.#collapsed,
        hasTransparentReserve: false
      })
    }
    this.enterStationaryMode(window)
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
      this.dependencies.enterPanelWindowPresentation?.({
        collapsed: this.#collapsed,
        hasTransparentReserve: false
      })
    }
    this.enterStationaryMode(window)
    this.#mode = 'detached'
    window.setAlwaysOnTop(false)
    window.setIgnoreMouseEvents(false)
    this.publishStateIfChanged()
    return true
  }

  setCollapsed(collapsed: boolean): boolean {
    const window = this.resolveWindow()
    if (!window) return false
    if (!this.#collapsed && collapsed && this.#mode !== 'following') {
      this.#stationaryExpandedBounds = captureStationaryExpandedBounds(
        window.getBounds(),
        this.#contentOffsetX
      )
    }
    this.#collapsed = collapsed

    if (this.#mode === 'following' && this.#lastTargetBounds) {
      this.applyFollowBounds(window)
    } else if (this.#mode === 'fixed' || this.#mode === 'detached') {
      this.applyStationaryBounds(window)
    }
    this.updatePanelWindowPresentation()
    this.publishStateIfChanged()
    return true
  }

  setPanelWidth(width: number): boolean {
    if (!Number.isFinite(width)) return false
    this.#panelWidth = normalizePanelWidth(width)
    const window = this.resolveWindow()
    if (window && this.#mode === 'following' && this.#lastTargetBounds) {
      this.applyFollowBounds(window)
    } else if (window && (this.#mode === 'fixed' || this.#mode === 'detached')) {
      this.applyStationaryBounds(window)
    }
    this.publishStateIfChanged()
    return true
  }

  resetPanelWidth(): boolean {
    return this.setPanelWidth(PANEL_WIDTH)
  }

  getSettings(): WindowFollowerSettingsDto {
    return (
      this.dependencies.getSettings?.() ?? {
        automaticAdhesion: true,
        currentApp: null,
        excludedApps: []
      }
    )
  }

  async excludeCurrentApp(): Promise<WindowFollowerSettingsDto> {
    const settings = await this.dependencies.excludeCurrentApp?.()
    await this.refresh(true)
    return settings ?? this.getSettings()
  }

  async removeExcludedApp(id: string): Promise<WindowFollowerSettingsDto> {
    const settings = await this.dependencies.removeExcludedApp?.(id)
    await this.refresh(true)
    return settings ?? this.getSettings()
  }

  hide(): boolean {
    const window = this.resolveWindow()
    if (!window) return false
    this.#hidden = true
    window.hide()
    return true
  }

  quit(): boolean {
    if (!this.dependencies.requestQuit) return false
    this.dependencies.requestQuit()
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
    const resolved = window && !window.isDestroyed() ? window : undefined
    this.observeWindow(resolved)
    return resolved
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
      constrainWindowToDisplay: true
    })
    this.#lastPanelResult = result
    this.#contentOffsetX = result.contentOffsetX
    this.commitPanelBounds(window, result.bounds)
    this.updatePanelWindowPresentation()
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

  private enterStationaryMode(window: BrowserWindowLike) {
    if (this.#mode === 'fixed' || this.#mode === 'detached') return

    const expandedBounds = captureStationaryExpandedBounds(window.getBounds(), this.#contentOffsetX)
    this.#stationaryExpandedBounds = expandedBounds
    this.#contentOffsetX = 0
    if (this.#lastPanelResult) {
      this.#lastPanelResult = {
        ...this.#lastPanelResult,
        bounds: expandedBounds,
        contentOffsetX: 0,
        contentScreenX: expandedBounds.x
      }
    }
    this.applyStationaryBounds(window, expandedBounds)
    this.applyMousePassthrough(window)
    this.updatePanelWindowPresentation()
  }

  private applyStationaryBounds(window: BrowserWindowLike, currentBounds = window.getBounds()) {
    const expandedBounds =
      this.#stationaryExpandedBounds ??
      captureStationaryExpandedBounds(currentBounds, this.#contentOffsetX)
    this.#stationaryExpandedBounds = expandedBounds
    const bounds = calculateStationaryPanelBounds({
      currentBounds,
      expandedBounds,
      collapsed: this.#collapsed,
      panelWidth: this.#panelWidth
    })
    this.commitPanelBounds(window, bounds)
  }

  private commitPanelBounds(window: BrowserWindowLike, bounds: Bounds) {
    this.#desiredBounds = { ...bounds }
    if (sameBounds(this.#lastAppliedBounds, bounds)) return

    this.#expectedProgrammaticBounds = { ...bounds }
    if (
      this.#lastAppliedBounds?.width === bounds.width &&
      this.#lastAppliedBounds.height === bounds.height
    ) {
      window.setPosition(bounds.x, bounds.y)
    } else {
      window.setBounds(bounds)
    }
    this.#lastAppliedBounds = { ...bounds }
  }

  private updatePanelWindowPresentation() {
    if (this.#mode === 'normal') return
    this.dependencies.enterPanelWindowPresentation?.({
      collapsed: this.#collapsed,
      hasTransparentReserve: this.#contentOffsetX > 0
    })
  }

  private observeWindow(window: BrowserWindowLike | undefined) {
    if (this.#observedWindow === window) return
    this.detachWindowMoveListener()
    if (!window) return
    this.#observedWindow = window
    window.on('move', this.handleWindowMove)
  }

  private detachWindowMoveListener() {
    this.#observedWindow?.removeListener('move', this.handleWindowMove)
    this.#observedWindow = null
  }

  private handleWindowMove = () => {
    const window = this.#observedWindow
    if (!window || window.isDestroyed()) return
    const currentBounds = window.getBounds()
    const stationaryMode = this.#mode === 'fixed' || this.#mode === 'detached'
    const result = coordinatePanelNativeMove({
      currentBounds,
      expectedProgrammaticBounds: this.#expectedProgrammaticBounds,
      stationaryMode,
      stationaryExpandedBounds: this.#stationaryExpandedBounds,
      collapsed: this.#collapsed,
      lastAppliedBounds: this.#lastAppliedBounds,
      desiredBounds: this.#desiredBounds
    })
    this.#expectedProgrammaticBounds = result.expectedProgrammaticBounds
    this.#lastAppliedBounds = result.lastAppliedBounds
    this.#desiredBounds = result.desiredBounds
    this.#stationaryExpandedBounds = result.stationaryExpandedBounds
  }

  private async runRefresh(forcePermissions: boolean) {
    const result = await this.dependencies.refreshContext!(forcePermissions)
    this.#lastRefreshResult = result
    if (!result.automaticAdhesionAvailable) {
      if (this.#mode === 'following') this.returnToNormal(false)
      this.publishStateIfChanged()
      return
    }

    if (result.targetExcluded) {
      this.resolveWindow()?.hide()
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
