import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WindowFollowerResizeHandle from '@/components/windowFollower/WindowFollowerResizeHandle.vue'

const store = vi.hoisted(() => ({
  setWidth: vi.fn(async () => undefined)
}))

vi.mock('@/stores/windowFollower', () => ({
  useWindowFollowerStore: () => store
}))

describe('WindowFollowerResizeHandle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  const mountHandle = () => {
    const surface = document.createElement('div')
    surface.dataset.windowFollowerSurface = 'panel'
    surface.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      right: 360,
      bottom: 800,
      left: 0,
      width: 360,
      height: 800,
      toJSON: () => ({})
    }))
    document.body.appendChild(surface)
    return mount(WindowFollowerResizeHandle, { attachTo: surface })
  }

  it('sends the latest rounded width once per animation frame', async () => {
    const wrapper = mountHandle()
    const handle = wrapper.get('[data-testid="window-follower-resize-handle"]')

    await handle.trigger('pointerdown', { pointerId: 1, clientX: 100 })
    await handle.trigger('pointermove', { pointerId: 1, clientX: 140 })
    await handle.trigger('pointermove', { pointerId: 1, clientX: 160 })
    await vi.runAllTimersAsync()

    expect(store.setWidth).toHaveBeenCalledOnce()
    expect(store.setWidth).toHaveBeenLastCalledWith(420)
  })

  it('flushes the final width immediately on pointer up', async () => {
    const wrapper = mountHandle()
    const handle = wrapper.get('[data-testid="window-follower-resize-handle"]')

    await handle.trigger('pointerdown', { pointerId: 2, clientX: 100 })
    await handle.trigger('pointermove', { pointerId: 2, clientX: 121.4 })
    await handle.trigger('pointerup', { pointerId: 2, clientX: 145.6 })

    expect(store.setWidth).toHaveBeenCalledOnce()
    expect(store.setWidth).toHaveBeenLastCalledWith(406)
  })
})
