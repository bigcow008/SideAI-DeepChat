import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const state = {
  mode: 'following',
  collapsed: false,
  panelWidth: 360,
  automaticAdhesionAvailable: true,
  snapshot: {
    app: { name: 'Code', stableKey: 'bundleId:com.microsoft.VSCode', processId: 42 },
    window: {
      windowId: 7,
      title: 'PRD.md - SideAI',
      bounds: { x: 100, y: 80, width: 1200, height: 800 }
    },
    freshness: 'live',
    capturedAt: 1_000,
    lastVerifiedAt: 1_000
  },
  permissions: {
    platform: 'macos',
    accessibility: 'granted',
    screenRecording: 'granted',
    checkedAt: 1_000
  },
  panelBounds: { x: 1304, y: 80, width: 360, height: 800 },
  displayBounds: [{ x: 0, y: 0, width: 1728, height: 1117 }],
  placement: 'right',
  contentOffsetX: 0,
  lastError: null,
  updatedAt: 1_010
}

const client = vi.hoisted(() => ({
  getState: vi.fn(async () => state),
  refresh: vi.fn(async () => state),
  onStateChanged: vi.fn(() => vi.fn())
}))

vi.mock('@api/WindowFollowerClient', () => ({
  createWindowFollowerClient: () => client
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('WindowFollowerDebugView', () => {
  it('renders live local diagnostics and exposes refresh, copy, and close commands', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { default: WindowFollowerDebugView } =
      await import('@/components/windowFollower/WindowFollowerDebugView.vue')
    const wrapper = mount(WindowFollowerDebugView)
    await flushPromises()

    expect(wrapper.get('[data-testid="window-follower-mode"]').text()).toContain('following')
    expect(wrapper.text()).toContain('PRD.md - SideAI')

    await wrapper.get('[data-testid="window-follower-refresh"]').trigger('click')
    await wrapper.get('[data-testid="window-follower-copy"]').trigger('click')
    await wrapper.get('[data-testid="window-follower-close"]').trigger('click')

    expect(client.refresh).toHaveBeenCalledOnce()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('com.microsoft.VSCode'))
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
