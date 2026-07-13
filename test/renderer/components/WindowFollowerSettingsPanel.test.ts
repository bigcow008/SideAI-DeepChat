import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WindowFollowerSettingsPanel from '@/components/windowFollower/WindowFollowerSettingsPanel.vue'

const store = vi.hoisted(() => ({
  state: {
    panelWidth: 360,
    automaticAdhesionAvailable: true,
    permissions: {
      platform: 'macos' as const,
      accessibility: 'granted' as const,
      screenRecording: 'granted' as const,
      checkedAt: 1_000
    }
  },
  settings: {
    automaticAdhesion: true,
    currentApp: {
      id: 'bundleId:com.microsoft.VSCode',
      matchType: 'bundleId' as const,
      name: 'Code',
      bundleId: 'com.microsoft.VSCode'
    },
    excludedApps: [
      {
        id: 'name:Terminal',
        matchType: 'name' as const,
        name: 'Terminal',
        createdAt: '2026-07-12T00:00:00.000Z'
      }
    ]
  },
  commandError: null as string | null,
  loadSettings: vi.fn(async () => undefined),
  setAutomaticAdhesion: vi.fn(async () => undefined),
  setWidth: vi.fn(async () => undefined),
  openPermissionSettings: vi.fn(async () => undefined),
  excludeCurrentApp: vi.fn(async () => undefined),
  removeExcludedApp: vi.fn(async () => undefined)
}))

const debugStore = vi.hoisted(() => ({ open: vi.fn() }))

vi.mock('@/stores/windowFollower', () => ({
  useWindowFollowerStore: () => store
}))

vi.mock('@/stores/windowFollowerDebug', () => ({
  useWindowFollowerDebugStore: () => debugStore
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.message ? `${key}:${String(params.message)}` : key
  })
}))

const SwitchStub = defineComponent({
  name: 'Switch',
  emits: ['update:modelValue'],
  template: '<button data-testid="switch-stub" />'
})

const SliderStub = defineComponent({
  name: 'Slider',
  emits: ['update:modelValue'],
  template: '<button data-testid="slider-stub" />'
})

const mountPanel = () =>
  mount(WindowFollowerSettingsPanel, {
    global: {
      stubs: {
        Icon: true,
        Switch: SwitchStub,
        Slider: SliderStub
      }
    }
  })

describe('WindowFollowerSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.commandError = null
  })

  it('loads settings and renders the complete accepted control set', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    expect(store.loadSettings).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="window-follower-settings-back"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-automatic-adhesion"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-width-slider"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-permission-accessibility"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-permission-screen-recording"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-exclude-current-app"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-restore-name:Terminal"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="window-follower-open-debug"]')).toBeTruthy()
    expect(wrapper.text()).toContain('360 px')
  })

  it('delegates adhesion, width, permission and exclusion changes to the single store', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    wrapper
      .getComponent('[data-testid="window-follower-automatic-adhesion"]')
      .vm.$emit('update:modelValue', false)
    await flushPromises()
    wrapper
      .getComponent('[data-testid="window-follower-width-slider"]')
      .vm.$emit('update:modelValue', [480])
    await flushPromises()
    await wrapper.get('[data-testid="window-follower-permission-accessibility"]').trigger('click')
    await flushPromises()
    await wrapper
      .get('[data-testid="window-follower-permission-screen-recording"]')
      .trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="window-follower-exclude-current-app"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="window-follower-restore-name:Terminal"]').trigger('click')
    await flushPromises()

    expect(store.setAutomaticAdhesion).toHaveBeenCalledWith(false)
    expect(store.loadSettings).toHaveBeenCalledTimes(2)
    expect(store.setWidth).toHaveBeenCalledWith(480)
    expect(store.openPermissionSettings).toHaveBeenNthCalledWith(1, 'accessibility')
    expect(store.openPermissionSettings).toHaveBeenNthCalledWith(2, 'screenRecording')
    expect(store.excludeCurrentApp).toHaveBeenCalledOnce()
    expect(store.removeExcludedApp).toHaveBeenCalledWith('name:Terminal')
  })

  it('opens debug or returns without creating a second settings window', async () => {
    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="window-follower-open-debug"]').trigger('click')
    expect(debugStore.open).toHaveBeenCalledOnce()
    expect(wrapper.emitted('close')).toEqual([[]])

    await wrapper.get('[data-testid="window-follower-settings-back"]').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[], []])
  })

  it('renders local command failures through the WindowFollower error catalog', async () => {
    store.commandError = 'offline'
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe(
      'chat.windowFollower.errors.commandFailed:offline'
    )
  })
})
