import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import WindowFollowerSurface from '@/components/windowFollower/WindowFollowerSurface.vue'

describe('WindowFollowerSurface', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('subtracts and translates the real content by a 44px transparent reserve', () => {
    const wrapper = mount(WindowFollowerSurface, {
      props: { mode: 'following', collapsed: false, contentOffsetX: 44 }
    })

    const surface = wrapper.get('[data-testid="window-follower-surface"]')
    expect(surface.attributes('style')).toContain('width: calc(100vw - 44px)')
    expect(surface.attributes('style')).toContain('transform: translateX(44px)')
  })

  it('does not translate zero-offset content', () => {
    const wrapper = mount(WindowFollowerSurface, {
      props: { mode: 'following', collapsed: false, contentOffsetX: 0 }
    })

    const surface = wrapper.get('[data-testid="window-follower-surface"]')
    expect(surface.attributes('style')).toContain('width: calc(100vw - 0px)')
    expect(surface.attributes('style')).toContain('transform: translateX(0px)')
  })

  it('keeps content mounted while showing the collapsed bubble', async () => {
    const wrapper = mount(WindowFollowerSurface, {
      attachTo: document.body,
      props: { mode: 'following', collapsed: false, contentOffsetX: 0 },
      slots: {
        default: '<input data-testid="draft" value="kept" />',
        collapsed: '<div data-testid="bubble" />'
      }
    })
    const draft = wrapper.get('[data-testid="draft"]').element

    await wrapper.setProps({ collapsed: true })

    expect(wrapper.get('[data-testid="draft"]').element).toBe(draft)
    expect(wrapper.get('[data-testid="window-follower-surface"]').isVisible()).toBe(false)
    expect(wrapper.get('[data-testid="bubble"]').exists()).toBe(true)
  })

  it('reports reserve and content pointer transitions without duplicate calls', async () => {
    const wrapper = mount(WindowFollowerSurface, {
      props: { mode: 'following', collapsed: false, contentOffsetX: 44 }
    })

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 20 }))
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }))
    await nextTick()

    expect(wrapper.emitted('pointer-interactive')).toEqual([[false], [true]])
  })
})
