import type { WindowFollowerDebugDto } from '@shared/windowFollower'
import { describe, expect, it, vi } from 'vitest'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

const panelState = (overrides: Partial<WindowFollowerDebugDto> = {}): WindowFollowerDebugDto => ({
  mode: 'following',
  collapsed: false,
  panelWidth: 360,
  automaticAdhesionAvailable: true,
  snapshot: null,
  permissions: {
    platform: 'macos',
    accessibility: 'granted',
    screenRecording: 'granted',
    checkedAt: 1_000
  },
  panelBounds: { x: 1204, y: 0, width: 404, height: 800 },
  displayBounds: [{ x: 0, y: 0, width: 1200, height: 900 }],
  placement: 'right',
  contentOffsetX: 44,
  lastError: null,
  updatedAt: 1_000,
  ...overrides
})

const setup = async () => {
  vi.resetModules()
  vi.doUnmock('pinia')
  const { createPinia, setActivePinia } = await vi.importActual<typeof import('pinia')>('pinia')
  setActivePinia(createPinia())

  let stateListener: ((state: WindowFollowerDebugDto) => void) | null = null
  const unsubscribe = vi.fn()
  const client = {
    getState: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    refresh: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    setMode: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    setCollapsed: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    setWidth: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    setPointerInteractive: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    setAutomaticAdhesion: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    openPermissionSettings: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    onStateChanged: vi.fn((listener: (state: WindowFollowerDebugDto) => void) => {
      stateListener = listener
      return unsubscribe
    })
  }

  vi.doMock('@api/WindowFollowerClient', () => ({
    createWindowFollowerClient: () => client
  }))

  const { useWindowFollowerStore } = await import('@/stores/windowFollower')
  return {
    store: useWindowFollowerStore(),
    client,
    unsubscribe,
    emitState: (state: WindowFollowerDebugDto) => stateListener?.(state)
  }
}

describe('WindowFollower store', () => {
  it('subscribes before loading state and preserves the newest event', async () => {
    const { store, client, emitState } = await setup()
    const initialState = deferred<WindowFollowerDebugDto>()
    client.getState.mockReturnValue(initialState.promise)

    const initializing = store.initialize()
    expect(client.onStateChanged).toHaveBeenCalledOnce()

    emitState(panelState({ panelWidth: 480, updatedAt: 2_000 }))
    initialState.resolve(panelState({ panelWidth: 360, updatedAt: 1_000 }))
    await initializing

    expect(store.state.panelWidth).toBe(480)
    expect(store.initialized).toBe(true)
    expect(store.initializationError).toBeNull()
  })

  it('falls back to normal desktop state when initialization fails', async () => {
    const { store, client } = await setup()
    client.getState.mockRejectedValue(new Error('bridge unavailable'))

    await store.initialize()

    expect(store.state.mode).toBe('normal')
    expect(store.state.contentOffsetX).toBe(0)
    expect(store.initialized).toBe(true)
    expect(store.initializationError).toContain('bridge unavailable')
  })

  it('keeps the previous observable state when a command fails', async () => {
    const { store, client } = await setup()
    client.getState.mockResolvedValue(panelState())
    client.setCollapsed.mockRejectedValue(new Error('native update failed'))
    await store.initialize()

    await expect(store.setCollapsed(true)).rejects.toThrow('native update failed')

    expect(store.state.collapsed).toBe(false)
    expect(store.commandError).toContain('native update failed')
  })

  it('unsubscribes from typed events when disposed', async () => {
    const { store, client, unsubscribe } = await setup()
    client.getState.mockResolvedValue(panelState())
    await store.initialize()

    store.dispose()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
