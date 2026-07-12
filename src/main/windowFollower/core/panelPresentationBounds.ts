import { COLLAPSED_BUBBLE_SIZE, MIN_PANEL_HEIGHT, normalizePanelWidth } from './panelBounds'
import type { Bounds } from '@shared/windowFollower'

export function captureStationaryExpandedBounds(
  currentBounds: Bounds,
  contentOffsetX: number
): Bounds {
  return {
    x: currentBounds.x + contentOffsetX,
    y: currentBounds.y,
    width: normalizePanelWidth(currentBounds.width - contentOffsetX),
    height: Math.max(currentBounds.height, MIN_PANEL_HEIGHT)
  }
}

export function calculateStationaryPanelBounds({
  currentBounds,
  expandedBounds,
  collapsed,
  panelWidth
}: {
  currentBounds: Bounds
  expandedBounds: Bounds
  collapsed: boolean
  panelWidth: number
}): Bounds {
  if (collapsed) {
    return {
      x: currentBounds.x,
      y: currentBounds.y,
      width: COLLAPSED_BUBBLE_SIZE,
      height: COLLAPSED_BUBBLE_SIZE
    }
  }
  return {
    x: currentBounds.x,
    y: currentBounds.y,
    width: normalizePanelWidth(panelWidth),
    height: Math.max(expandedBounds.height, MIN_PANEL_HEIGHT)
  }
}

export function updateStationaryExpandedBoundsFromMove({
  currentBounds,
  expandedBounds,
  collapsed
}: {
  currentBounds: Bounds
  expandedBounds: Bounds
  collapsed: boolean
}): Bounds {
  if (collapsed) return { ...expandedBounds, x: currentBounds.x, y: currentBounds.y }
  return {
    x: currentBounds.x,
    y: currentBounds.y,
    width: normalizePanelWidth(currentBounds.width),
    height: Math.max(currentBounds.height, MIN_PANEL_HEIGHT)
  }
}

export type PanelNativeMoveKind = 'programmatic' | 'stationary-user' | 'following-user'

export function coordinatePanelNativeMove({
  currentBounds,
  expectedProgrammaticBounds,
  stationaryMode,
  stationaryExpandedBounds,
  collapsed,
  lastAppliedBounds,
  desiredBounds
}: {
  currentBounds: Bounds
  expectedProgrammaticBounds: Bounds | null
  stationaryMode: boolean
  stationaryExpandedBounds: Bounds | null
  collapsed: boolean
  lastAppliedBounds: Bounds | null
  desiredBounds: Bounds | null
}): {
  kind: PanelNativeMoveKind
  expectedProgrammaticBounds: Bounds | null
  lastAppliedBounds: Bounds | null
  desiredBounds: Bounds | null
  stationaryExpandedBounds: Bounds | null
} {
  if (
    expectedProgrammaticBounds &&
    currentBounds.x === expectedProgrammaticBounds.x &&
    currentBounds.y === expectedProgrammaticBounds.y &&
    currentBounds.width === expectedProgrammaticBounds.width &&
    currentBounds.height === expectedProgrammaticBounds.height
  ) {
    return {
      kind: 'programmatic',
      expectedProgrammaticBounds: null,
      lastAppliedBounds,
      desiredBounds,
      stationaryExpandedBounds
    }
  }

  const nextExpandedBounds = stationaryMode
    ? updateStationaryExpandedBoundsFromMove({
        currentBounds,
        expandedBounds:
          stationaryExpandedBounds ?? captureStationaryExpandedBounds(currentBounds, 0),
        collapsed
      })
    : stationaryExpandedBounds

  return {
    kind: stationaryMode ? 'stationary-user' : 'following-user',
    expectedProgrammaticBounds: null,
    lastAppliedBounds: currentBounds,
    desiredBounds: currentBounds,
    stationaryExpandedBounds: nextExpandedBounds
  }
}
