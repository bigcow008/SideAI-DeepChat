import { describe, expect, it } from 'vitest'
import {
  DESKTOP_DEFAULT_HEIGHT,
  DESKTOP_DEFAULT_WIDTH,
  DESKTOP_MIN_HEIGHT,
  DESKTOP_MIN_WIDTH,
  normalizeDesktopWindowBounds
} from '@/presenter/windowPresenter/managedWindowBounds'

describe('managed desktop window bounds', () => {
  it('uses a complete DeepChat desktop default', () => {
    expect(DESKTOP_DEFAULT_WIDTH).toBe(1200)
    expect(DESKTOP_DEFAULT_HEIGHT).toBe(800)
  })

  it('clamps a previously persisted compact panel size', () => {
    expect(normalizeDesktopWindowBounds({ x: 20, y: 30, width: 404, height: 700 })).toEqual({
      x: 20,
      y: 30,
      width: DESKTOP_MIN_WIDTH,
      height: 700
    })
    expect(normalizeDesktopWindowBounds({ x: 20, y: 30, width: 800, height: 500 })).toEqual({
      x: 20,
      y: 30,
      width: DESKTOP_MIN_WIDTH,
      height: DESKTOP_MIN_HEIGHT
    })
  })
})
