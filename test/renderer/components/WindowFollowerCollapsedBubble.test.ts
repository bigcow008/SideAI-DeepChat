import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WindowFollowerCollapsedBubble from '@/components/windowFollower/WindowFollowerCollapsedBubble.vue'

const store = vi.hoisted(() => ({
  setCollapsed: vi.fn(async () => undefined)
}))

vi.mock('@/stores/windowFollower', () => ({
  useWindowFollowerStore: () => store
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('WindowFollowerCollapsedBubble', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps a 36px draggable outer bubble and a 22px expand hit target', () => {
    const wrapper = mount(WindowFollowerCollapsedBubble)

    expect(wrapper.get('[data-testid="window-follower-bubble"]').classes()).toContain(
      'window-follower-bubble'
    )
    expect(wrapper.get('[data-testid="window-follower-bubble-expand"]').classes()).toContain(
      'window-follower-bubble-expand'
    )
  })

  it('expands the native panel without remounting chat content', async () => {
    const wrapper = mount(WindowFollowerCollapsedBubble)

    await wrapper.get('[data-testid="window-follower-bubble-expand"]').trigger('click')
    await flushPromises()

    expect(store.setCollapsed).toHaveBeenCalledWith(false)
  })
})
