import { describe, expect, it, vi } from 'vitest'
import {
  createTimedSingleFlightReader,
  TargetReadTimeoutError
} from '@/windowFollower/core/timedSingleFlightReader'
import {
  recordLiveTarget,
  recordTargetMiss,
  retainTargetWhileSelfFocused
} from '@/windowFollower/core/targetTracker'
import {
  calculatePanelBoundsForDisplay,
  COLLAPSED_BUBBLE_SIZE
} from '@/windowFollower/core/panelBounds'
import {
  shouldFollowTarget,
  shouldKeepPanelAlwaysOnTop,
  toggleDetachedMode,
  toggleLockedMode
} from '@/windowFollower/core/panelMode'
import { decidePanelFollowForTarget } from '@/windowFollower/core/panelFollowDecision'
import { decidePanelMousePassthrough } from '@/windowFollower/core/panelMousePassthrough'
import {
  calculateStationaryPanelBounds,
  coordinatePanelNativeMove
} from '@/windowFollower/core/panelPresentationBounds'
import { createPanelUpdateCoordinator } from '@/windowFollower/core/panelUpdateCoordinator'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

describe('timed single-flight reader', () => {
  it('rejects a fulfillment after the original deadline before the timer callback runs', async () => {
    const pending = deferred<{ id: number }>()
    let now = 0
    const read = createTimedSingleFlightReader(
      () => pending.promise,
      100,
      () => now
    )

    const result = read()
    await Promise.resolve()
    now = 101
    pending.resolve({ id: 7 })

    await expect(result).rejects.toBeInstanceOf(TargetReadTimeoutError)
  })

  it('reuses an unsettled read for concurrent callers', async () => {
    const pending = deferred<number>()
    const underlyingRead = vi.fn(() => pending.promise)
    const read = createTimedSingleFlightReader(underlyingRead, 100)

    const first = read()
    const second = read()
    pending.resolve(9)

    await expect(Promise.all([first, second])).resolves.toEqual([9, 9])
    expect(underlyingRead).toHaveBeenCalledOnce()
  })
})

describe('target freshness', () => {
  it('does not refresh the capture time while DeepChat itself is focused', () => {
    const live = recordLiveTarget({ id: 7 }, 1_000)
    expect(retainTargetWhileSelfFocused(live)).toEqual({ ...live, freshness: 'retained' })
  })

  it('expires from the last live sample after the grace period', () => {
    const live = recordLiveTarget({ id: 7 }, 1_000)
    expect(recordTargetMiss(live, 2_001, 'closed', 1_000)).toEqual({
      target: null,
      freshness: 'unavailable',
      capturedAt: null,
      error: 'closed'
    })
  })
})

describe('multi-display panel geometry', () => {
  const primary = {
    bounds: { x: 0, y: 0, width: 1728, height: 1117 },
    workArea: { x: 0, y: 0, width: 1728, height: 1080 }
  }

  it('does not reserve transparent width when content intersects a right-hand display', () => {
    const right = {
      bounds: { x: 1728, y: 0, width: 1440, height: 900 },
      workArea: { x: 1728, y: 0, width: 1440, height: 860 }
    }
    const result = calculatePanelBoundsForDisplay({
      targetBounds: { x: 0, y: 0, width: 1728, height: 1080 },
      display: primary,
      displays: [primary, right],
      userCollapsed: false,
      constrainWindowToDisplay: true
    })

    expect(result.contentOffsetX).toBe(0)
    expect(result.bounds.x).toBe(1732)
  })

  it('keeps the full panel visible when no display can contain it to the right', () => {
    const result = calculatePanelBoundsForDisplay({
      targetBounds: { x: 0, y: 0, width: 1728, height: 1080 },
      display: primary,
      displays: [primary],
      userCollapsed: false,
      constrainWindowToDisplay: true
    })

    expect(result.placement).toBe('screen-right')
    expect(result.contentOffsetX).toBe(0)
    expect(result.bounds).toMatchObject({ x: 1368, width: 360 })
  })

  it('does not treat a narrow on-screen sliver as a visible panel', () => {
    const result = calculatePanelBoundsForDisplay({
      targetBounds: { x: 99, y: 61, width: 1566, height: 1004 },
      display: primary,
      displays: [primary],
      userCollapsed: false,
      constrainWindowToDisplay: true
    })

    expect(result.placement).toBe('screen-right')
    expect(result.bounds).toEqual({ x: 1368, y: 61, width: 360, height: 1004 })
  })

  it('collapses the native window to the real bubble size', () => {
    const result = calculatePanelBoundsForDisplay({
      targetBounds: { x: 100, y: 80, width: 900, height: 700 },
      display: primary,
      userCollapsed: true
    })
    expect(result.bounds.width).toBe(COLLAPSED_BUBBLE_SIZE)
    expect(result.bounds.height).toBe(COLLAPSED_BUBBLE_SIZE)
  })
})

describe('panel behavior decisions', () => {
  it('keeps fixed and detached modes mutually exclusive', () => {
    const base = { locked: false, detached: false, automaticAdhesionAvailable: true }
    const fixed = toggleLockedMode(base)
    const detached = toggleDetachedMode(fixed)

    expect(fixed).toEqual({ ...base, locked: true })
    expect(detached).toEqual({ ...base, detached: true })
    expect(shouldFollowTarget(detached)).toBe(false)
    expect(shouldKeepPanelAlwaysOnTop(detached)).toBe(false)
  })

  it('hides excluded targets without publishing their window info', () => {
    expect(decidePanelFollowForTarget({ targetExcluded: true })).toEqual({
      suppressedForExcludedApp: true,
      shouldApplyFollow: false,
      shouldSendWindowInfo: false,
      shouldHidePanel: true
    })
  })

  it('passes pointer events through only a transparent reserve', () => {
    expect(
      decidePanelMousePassthrough({
        hasTransparentReserve: true,
        contentPointerInteractive: false
      })
    ).toEqual({ ignoreMouseEvents: true, forward: true })
  })
})

describe('stationary presentation and update coordination', () => {
  it('expands at the dragged bubble position using the latest width', () => {
    expect(
      calculateStationaryPanelBounds({
        currentBounds: { x: 1260, y: 180, width: 36, height: 36 },
        expandedBounds: { x: 1200, y: 120, width: 420, height: 700 },
        collapsed: false,
        panelWidth: 480
      })
    ).toEqual({ x: 1260, y: 180, width: 480, height: 700 })
  })

  it('does not replace an active animation target for a programmatic move event', () => {
    const expected = { x: 1200, y: 120, width: 360, height: 700 }
    const desired = { x: 1300, y: 120, width: 360, height: 700 }
    expect(
      coordinatePanelNativeMove({
        currentBounds: expected,
        expectedProgrammaticBounds: expected,
        stationaryMode: false,
        stationaryExpandedBounds: null,
        collapsed: false,
        lastAppliedBounds: null,
        desiredBounds: desired
      })
    ).toMatchObject({ kind: 'programmatic', desiredBounds: desired })
  })

  it('runs one requested fresh update after the active update', async () => {
    const first = deferred<void>()
    let runs = 0
    const coordinator = createPanelUpdateCoordinator(async () => {
      runs += 1
      if (runs === 1) await first.promise
    })

    const active = coordinator.update()
    const fresh = coordinator.updateFresh()
    first.resolve()
    await Promise.all([active, fresh])

    expect(runs).toBe(2)
  })
})
