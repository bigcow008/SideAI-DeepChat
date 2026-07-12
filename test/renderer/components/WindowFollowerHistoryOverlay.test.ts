import { nextTick, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createSession = (
  id: string,
  title: string,
  options: { pinned?: boolean; projectDir?: string } = {}
) => ({
  id,
  title,
  agentId: 'deepchat',
  status: 'none' as const,
  projectDir: options.projectDir ?? '',
  isPinned: options.pinned ?? false,
  isDraft: false,
  sessionKind: 'regular' as const,
  parentSessionId: null,
  subagentEnabled: false,
  subagentMeta: null,
  createdAt: 1,
  updatedAt: 2
})

const setup = async (options?: {
  hasMore?: boolean
  loadingMore?: boolean
  onClose?: () => void
}) => {
  vi.resetModules()

  const pinned = createSession('session-1', 'Pinned session', { pinned: true })
  const grouped = createSession('session-2', 'Grouped session', {
    projectDir: '/workspace/SideAI'
  })
  const sessionStore = reactive({
    activeSessionId: 'session-1',
    loading: false,
    loadingMore: options?.loadingMore ?? false,
    hasMore: options?.hasMore ?? false,
    sessionGroups: [
      {
        id: '/workspace/SideAI',
        label: 'SideAI',
        sessions: [grouped]
      }
    ],
    getPinnedSessions: vi.fn(() => [pinned]),
    loadNextPage: vi.fn().mockResolvedValue(undefined),
    selectSession: vi.fn().mockResolvedValue(undefined)
  })

  vi.doMock('@/stores/ui/session', () => ({ useSessionStore: () => sessionStore }))
  vi.doMock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key })
  }))

  const WindowFollowerHistoryOverlay = (
    await import('@/components/windowFollower/WindowFollowerHistoryOverlay.vue')
  ).default
  const wrapper = mount(WindowFollowerHistoryOverlay, {
    props: {
      onClose: options?.onClose
    },
    global: {
      stubs: {
        Icon: true
      }
    }
  })

  return { wrapper, sessionStore }
}

const setListMetrics = (
  element: Element,
  metrics: { scrollTop: number; scrollHeight: number; clientHeight: number }
) => {
  Object.defineProperties(element, {
    scrollTop: { configurable: true, writable: true, value: metrics.scrollTop },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    clientHeight: { configurable: true, value: metrics.clientHeight }
  })
}

describe('WindowFollowerHistoryOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.removeAttribute('data-window-follower-surface')
  })

  it('renders pinned and existing session groups and selects through the session store', async () => {
    const { wrapper, sessionStore } = await setup()

    expect(sessionStore.getPinnedSessions).toHaveBeenCalledWith(null)
    expect(wrapper.text()).toContain('Pinned session')
    expect(wrapper.text()).toContain('SideAI')
    expect(wrapper.text()).toContain('Grouped session')

    await wrapper.get('[data-session-id="session-2"]').trigger('click')
    await flushPromises()

    expect(sessionStore.selectSession).toHaveBeenCalledWith('session-2')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('loads the next existing session page near the overlay bottom', async () => {
    const { wrapper, sessionStore } = await setup({ hasMore: true })
    const list = wrapper.get('[data-testid="window-follower-history-list"]')
    setListMetrics(list.element, { scrollTop: 420, scrollHeight: 600, clientHeight: 120 })

    await list.trigger('scroll')
    await vi.runAllTimersAsync()
    await flushPromises()

    expect(sessionStore.loadNextPage).toHaveBeenCalledOnce()
  })

  it('does not request another page while the session store is already loading more', async () => {
    const { wrapper, sessionStore } = await setup({ hasMore: true, loadingMore: true })
    const list = wrapper.get('[data-testid="window-follower-history-list"]')
    setListMetrics(list.element, { scrollTop: 420, scrollHeight: 600, clientHeight: 120 })

    await list.trigger('scroll')
    await vi.runAllTimersAsync()

    expect(sessionStore.loadNextPage).not.toHaveBeenCalled()
  })

  it('closes from the backdrop without treating panel clicks as backdrop clicks', async () => {
    const { wrapper } = await setup()

    await wrapper.get('[data-testid="window-follower-history-panel"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.get('[data-testid="window-follower-history-backdrop"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes on Escape and removes the listener after unmount', async () => {
    const onClose = vi.fn()
    const { wrapper } = await setup({ onClose })

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(onClose).toHaveBeenCalledOnce()

    wrapper.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
