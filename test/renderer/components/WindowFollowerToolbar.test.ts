import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WindowFollowerToolbar from '@/components/windowFollower/WindowFollowerToolbar.vue'

const store = vi.hoisted(() => ({
  state: {
    mode: 'following' as 'normal' | 'following' | 'fixed' | 'detached',
    collapsed: false
  },
  setMode: vi.fn(async () => undefined),
  setCollapsed: vi.fn(async () => undefined),
  resetWidth: vi.fn(async () => undefined),
  hide: vi.fn(async () => true),
  quit: vi.fn(async () => true)
}))

vi.mock('@/stores/windowFollower', () => ({
  useWindowFollowerStore: () => store
}))

const passthrough = { template: '<div><slot /></div>' }

const mountToolbar = () =>
  mount(WindowFollowerToolbar, {
    global: {
      stubs: {
        Icon: true,
        TooltipProvider: passthrough,
        Tooltip: passthrough,
        TooltipTrigger: passthrough,
        TooltipContent: passthrough
      }
    }
  })

describe('WindowFollowerToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.state.mode = 'following'
    store.state.collapsed = false
  })

  it('starts with only the horizontal group toggle and a drag region', () => {
    const wrapper = mountToolbar()

    expect(wrapper.get('[data-testid="window-follower-toolbar-toggle"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-toolbar-drag"]')).toBeTruthy()
    expect(wrapper.find('[data-testid="window-follower-collapse-panel"]').exists()).toBe(false)
  })

  it('expands every accepted SideAI command in the original order', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('[data-testid="window-follower-toolbar-toggle"]').trigger('click')

    expect(
      wrapper
        .findAll('[data-window-follower-command]')
        .map((node) => node.attributes('data-window-follower-command'))
    ).toEqual(['collapse', 'pin', 'detach', 'reset-width', 'settings', 'hide', 'quit'])
  })

  it('does not treat the toolbar group toggle as panel collapse', async () => {
    const wrapper = mountToolbar()

    await wrapper.get('[data-testid="window-follower-toolbar-toggle"]').trigger('click')
    expect(store.setCollapsed).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="window-follower-collapse-panel"]').trigger('click')
    await flushPromises()

    expect(store.setCollapsed).toHaveBeenCalledWith(true)
    expect(wrapper.find('[data-testid="window-follower-collapse-panel"]').exists()).toBe(false)
  })

  it('keeps pin and detach mutually exclusive and closes the group after commands', async () => {
    const wrapper = mountToolbar()
    await wrapper.get('[data-testid="window-follower-toolbar-toggle"]').trigger('click')

    await wrapper.get('[data-window-follower-command="pin"]').trigger('click')
    await flushPromises()
    expect(store.setMode).toHaveBeenCalledWith('fixed')
    expect(wrapper.find('[data-window-follower-command="pin"]').exists()).toBe(false)

    store.state.mode = 'fixed'
    await wrapper.get('[data-testid="window-follower-toolbar-toggle"]').trigger('click')
    await wrapper.get('[data-window-follower-command="detach"]').trigger('click')
    await flushPromises()
    expect(store.setMode).toHaveBeenLastCalledWith('detached')
  })

  it('closes the horizontal group before opening settings', async () => {
    const wrapper = mountToolbar()
    await wrapper.get('[data-testid="window-follower-toolbar-toggle"]').trigger('click')

    await wrapper.get('[data-window-follower-command="settings"]').trigger('click')

    expect(wrapper.emitted('open-settings')).toEqual([[]])
    expect(wrapper.find('[data-window-follower-command="settings"]').exists()).toBe(false)
  })
})
