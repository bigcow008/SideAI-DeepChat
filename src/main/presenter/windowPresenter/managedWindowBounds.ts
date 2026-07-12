import type { Bounds } from '@shared/windowFollower'

export const DESKTOP_DEFAULT_WIDTH = 1200
export const DESKTOP_DEFAULT_HEIGHT = 800
export const DESKTOP_MIN_WIDTH = 960
export const DESKTOP_MIN_HEIGHT = 640

export function normalizeDesktopWindowBounds(bounds: Bounds): Bounds {
  return {
    ...bounds,
    width: Math.max(DESKTOP_MIN_WIDTH, Math.round(bounds.width)),
    height: Math.max(DESKTOP_MIN_HEIGHT, Math.round(bounds.height))
  }
}
