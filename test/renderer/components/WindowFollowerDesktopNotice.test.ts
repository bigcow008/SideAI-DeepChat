import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WindowFollowerDesktopNotice from '@/components/windowFollower/WindowFollowerDesktopNotice.vue'

const store = vi.hoisted(() => ({
  state: {
    mode: 'normal' as 'normal' | 'following' | 'fixed' | 'detached',
    permissions: {
      platform: 'macos' as 'macos' | 'windows' | 'linux' | 'other' | 'unknown',
      accessibility: 'missing' as 'granted' | 'missing' | 'unknown' | 'not-applicable',
      screenRecording: 'missing' as 'granted' | 'missing' | 'unknown' | 'not-applicable'
    }
  },
  settings: { automaticAdhesion: true },
  loadSettings: vi.fn(async () => undefined),
  openPermissionSettings: vi.fn(async () => undefined),
  setAutomaticAdhesion: vi.fn(async () => undefined)
}))

vi.mock('@/stores/windowFollower', () => ({
  useWindowFollowerStore: () => store
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mountNotice = () =>
  mount(WindowFollowerDesktopNotice, {
    global: { stubs: { Icon: true } }
  })

describe('WindowFollowerDesktopNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.state.mode = 'normal'
    store.state.permissions.platform = 'macos'
    store.state.permissions.accessibility = 'missing'
    store.state.permissions.screenRecording = 'missing'
    store.settings.automaticAdhesion = true
  })

  it('keeps both macOS permission actions reachable from the normal window', async () => {
    const wrapper = mountNotice()
    await flushPromises()

    expect(store.loadSettings).toHaveBeenCalledOnce()
    await wrapper.get('[data-testid="window-follower-desktop-accessibility"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="window-follower-desktop-screen-recording"]').trigger('click')
    await flushPromises()

    expect(store.openPermissionSettings).toHaveBeenNthCalledWith(1, 'accessibility')
    expect(store.openPermissionSettings).toHaveBeenNthCalledWith(2, 'screenRecording')
  })

  it('lets the user re-enable automatic following after it was paused', async () => {
    store.state.permissions.accessibility = 'granted'
    store.state.permissions.screenRecording = 'granted'
    store.settings.automaticAdhesion = false
    const wrapper = mountNotice()
    await flushPromises()

    await wrapper.get('[data-testid="window-follower-desktop-enable"]').trigger('click')
    await flushPromises()

    expect(store.setAutomaticAdhesion).toHaveBeenCalledWith(true)
    expect(store.loadSettings).toHaveBeenCalledTimes(2)
  })

  it('stays hidden outside the supported macOS normal surface', async () => {
    store.state.permissions.platform = 'windows'
    const wrapper = mountNotice()
    await flushPromises()

    expect(wrapper.find('[data-testid="window-follower-desktop-notice"]').exists()).toBe(false)
  })
})
