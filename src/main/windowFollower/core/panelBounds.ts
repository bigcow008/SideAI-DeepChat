import type { Bounds } from '@shared/windowFollower'

export const PANEL_WIDTH = 360
export const MIN_PANEL_WIDTH = 230
export const COLLAPSED_BUBBLE_SIZE = 36
export const COLLAPSED_BUBBLE_TOP_OFFSET = 14
export const MIN_PANEL_HEIGHT = 400
export const EDGE_GAP = 4
export const RIGHT_EDGE_OVERFLOW_TOLERANCE = 64
export const RIGHT_EDGE_WIDE_WINDOW_RATIO = 0.85
export const RIGHT_EDGE_VISIBLE_RESERVE = 44

type DisplayBounds = {
  bounds: Bounds
  workArea: Bounds
}

export type PanelBoundsResult = {
  bounds: Bounds
  placement: 'right' | 'screen-right' | 'rail-right'
  actualCollapsed: boolean
  autoCollapsed: boolean
  contentOffsetX: number
  contentScreenX: number
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

function rectanglesIntersect(first: Bounds, second: Bounds) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  )
}

function rightEdgeAnchorX(targetBounds: Bounds, display: DisplayBounds) {
  const workAreaRight = display.workArea.x + display.workArea.width
  const screenRight = display.bounds.x + display.bounds.width
  const visibleRight = Math.max(workAreaRight, screenRight)
  const targetRight = targetBounds.x + targetBounds.width
  const wideEnoughForEdgeAlignment =
    targetBounds.width >= display.bounds.width * RIGHT_EDGE_WIDE_WINDOW_RATIO

  if (wideEnoughForEdgeAlignment && targetRight >= visibleRight - RIGHT_EDGE_OVERFLOW_TOLERANCE) {
    return Math.max(targetRight, visibleRight)
  }

  return targetRight
}

export function normalizePanelWidth(panelWidth: number | undefined) {
  if (typeof panelWidth !== 'number' || !Number.isFinite(panelWidth)) return PANEL_WIDTH
  return Math.max(MIN_PANEL_WIDTH, Math.round(panelWidth))
}

export function calculatePanelBoundsForDisplay({
  targetBounds,
  display,
  displays = [display],
  userCollapsed,
  panelWidth,
  constrainWindowToVisibleReserve = false
}: {
  targetBounds: Bounds | null
  display: DisplayBounds
  displays?: DisplayBounds[]
  userCollapsed: boolean
  panelWidth?: number
  constrainWindowToVisibleReserve?: boolean
}): PanelBoundsResult {
  const workArea = display.workArea
  const desiredHeight = targetBounds ? targetBounds.height : workArea.height
  const height = userCollapsed
    ? COLLAPSED_BUBBLE_SIZE
    : clamp(
        Math.max(Math.round(desiredHeight), MIN_PANEL_HEIGHT),
        MIN_PANEL_HEIGHT,
        workArea.height
      )
  const actualWidth = userCollapsed ? COLLAPSED_BUBBLE_SIZE : normalizePanelWidth(panelWidth)

  if (!targetBounds) {
    const x = Math.round(workArea.x + workArea.width - actualWidth)
    return {
      bounds: {
        x,
        y: Math.round(workArea.y + (workArea.height - height) / 2),
        width: actualWidth,
        height
      },
      placement: 'screen-right',
      actualCollapsed: userCollapsed,
      autoCollapsed: false,
      contentOffsetX: 0,
      contentScreenX: x
    }
  }

  const anchorX = rightEdgeAnchorX(targetBounds, display)
  const y = userCollapsed
    ? Math.round(targetBounds.y + COLLAPSED_BUBBLE_TOP_OFFSET)
    : Math.round(targetBounds.y)
  const contentScreenX = Math.round(anchorX + EDGE_GAP)
  const contentBounds = { x: contentScreenX, y, width: actualWidth, height }
  const shouldUseVisibleReserve = !displays.some((candidate) =>
    rectanglesIntersect(contentBounds, candidate.bounds)
  )
  const contentOffsetX =
    shouldUseVisibleReserve && constrainWindowToVisibleReserve ? RIGHT_EDGE_VISIBLE_RESERVE : 0
  const x = contentOffsetX > 0 ? contentScreenX - contentOffsetX : contentScreenX

  return {
    bounds: { x, y, width: actualWidth + contentOffsetX, height },
    placement: userCollapsed ? 'rail-right' : 'right',
    actualCollapsed: userCollapsed,
    autoCollapsed: false,
    contentOffsetX,
    contentScreenX
  }
}
