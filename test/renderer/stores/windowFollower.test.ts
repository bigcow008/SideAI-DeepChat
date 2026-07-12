import type { WindowFollowerDebugDto, WindowFollowerSettingsDto } from '@shared/windowFollower'
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

const settings = (
  overrides: Partial<WindowFollowerSettingsDto> = {}
): WindowFollowerSettingsDto => ({
  automaticAdhesion: true,
  currentApp: null,
  excludedApps: [],
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
    resetWidth: vi.fn<() => Promise<WindowFollowerDebugDto>>(),
    getSettings: vi.fn<() => Promise<WindowFollowerSettingsDto>>(),
    excludeCurrentApp:
      vi.fn<
        () => Promise<{ settings: WindowFollowerSettingsDto; state: WindowFollowerDebugDto }>
      >(),
    removeExcludedApp:
      vi.fn<
        () => Promise<{ settings: WindowFollowerSettingsDto; state: WindowFollowerDebugDto }>
      >(),
    hide: vi.fn<() => Promise<boolean>>(),
    quit: vi.fn<() => Promise<boolean>>(),
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

  it('loads settings and applies successful reset and exclusion commands', async () => {
    const { store, client } = await setup()
    const initialSettings = settings()
    const excludedSettings = settings({
      currentApp: {
        id: 'bundleId:com.microsoft.VSCode',
        matchType: 'bundleId',
        name: 'Code',
        bundleId: 'com.microsoft.VSCode'
      },
      excludedApps: [
        {
          id: 'bundleId:com.microsoft.VSCode',
          matchType: 'bundleId',
          name: 'Code',
          bundleId: 'com.microsoft.VSCode',
          createdAt: '2026-07-12T00:00:00.000Z'
        }
      ]
    })
    client.getSettings.mockResolvedValue(initialSettings)
    client.resetWidth.mockResolvedValue(panelState({ panelWidth: 360 }))
    client.excludeCurrentApp.mockResolvedValue({
      settings: excludedSettings,
      state: panelState({ lastError: '目标应用已排除' })
    })

    await store.loadSettings()
    await store.resetWidth()
    await store.excludeCurrentApp()

    expect(store.settings).toEqual(excludedSettings)
    expect(store.state.panelWidth).toBe(360)
    expect(store.state.lastError).toBe('目标应用已排除')
  })

  it('preserves previous settings and state when an exclusion command fails', async () => {
    const { store, client } = await setup()
    const previousSettings = settings({
      excludedApps: [
        {
          id: 'name:Terminal',
          matchType: 'name',
          name: 'Terminal',
          createdAt: '2026-07-12T00:00:00.000Z'
        }
      ]
    })
    client.getState.mockResolvedValue(panelState())
    client.getSettings.mockResolvedValue(previousSettings)
    client.removeExcludedApp.mockRejectedValue(new Error('persist failed'))
    await store.initialize()
    await store.loadSettings()

    await expect(store.removeExcludedApp('name:Terminal')).rejects.toThrow('persist failed')

    expect(store.settings).toEqual(previousSettings)
    expect(store.state).toEqual(panelState())
    expect(store.commandError).toContain('persist failed')
  })

  it('delegates hide and quit without changing observable container state', async () => {
    const { store, client } = await setup()
    client.getState.mockResolvedValue(panelState())
    client.hide.mockResolvedValue(true)
    client.quit.mockResolvedValue(true)
    await store.initialize()

    await expect(store.hide()).resolves.toBe(true)
    await expect(store.quit()).resolves.toBe(true)

    expect(store.state).toEqual(panelState())
  })

  it('unsubscribes from typed events when disposed', async () => {
    const { store, client, unsubscribe } = await setup()
    client.getState.mockResolvedValue(panelState())
    await store.initialize()

    store.dispose()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
