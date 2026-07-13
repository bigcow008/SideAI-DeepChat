import { describe, expect, it, vi } from 'vitest'
import type { DeepchatBridge } from '@shared/contracts/bridge'
import { createWindowFollowerClient } from '../../../src/renderer/api/WindowFollowerClient'

describe('WindowFollowerClient', () => {
  it('uses the typed DeepChat bridge for WindowFollower commands', async () => {
    const state = { mode: 'normal' }
    const settings = {
      automaticAdhesion: true,
      currentApp: null,
      excludedApps: []
    }
    const bridge = {
      invoke: vi.fn(async (routeName: string) => {
        if (routeName === 'windowFollower.getSettings') return { settings }
        if (
          routeName === 'windowFollower.excludeCurrentApp' ||
          routeName === 'windowFollower.removeExcludedApp'
        ) {
          return { settings, state }
        }
        if (routeName === 'windowFollower.hide') return { hidden: true }
        if (routeName === 'windowFollower.quit') return { requested: true }
        return { state }
      }),
      on: vi.fn(() => vi.fn())
    } as unknown as DeepchatBridge
    const client = createWindowFollowerClient(bridge)

    await expect(client.getState()).resolves.toBe(state)
    await client.setMode('fixed')
    await client.setCollapsed(true)
    await client.openPermissionSettings('screenRecording')
    await expect(client.resetWidth()).resolves.toBe(state)
    await expect(client.getSettings()).resolves.toBe(settings)
    await expect(client.excludeCurrentApp()).resolves.toEqual({ settings, state })
    await expect(client.removeExcludedApp('bundleId:com.microsoft.VSCode')).resolves.toEqual({
      settings,
      state
    })
    await expect(client.hide()).resolves.toBe(true)
    await expect(client.quit()).resolves.toBe(true)
    const listener = vi.fn()
    client.onStateChanged(listener)

    expect(bridge.invoke).toHaveBeenNthCalledWith(1, 'windowFollower.getState', {})
    expect(bridge.invoke).toHaveBeenNthCalledWith(2, 'windowFollower.setMode', { mode: 'fixed' })
    expect(bridge.invoke).toHaveBeenNthCalledWith(3, 'windowFollower.setCollapsed', {
      collapsed: true
    })
    expect(bridge.invoke).toHaveBeenNthCalledWith(4, 'windowFollower.openPermissionSettings', {
      permission: 'screenRecording'
    })
    expect(bridge.invoke).toHaveBeenNthCalledWith(5, 'windowFollower.resetWidth', {})
    expect(bridge.invoke).toHaveBeenNthCalledWith(6, 'windowFollower.getSettings', {})
    expect(bridge.invoke).toHaveBeenNthCalledWith(7, 'windowFollower.excludeCurrentApp', {})
    expect(bridge.invoke).toHaveBeenNthCalledWith(8, 'windowFollower.removeExcludedApp', {
      id: 'bundleId:com.microsoft.VSCode'
    })
    expect(bridge.invoke).toHaveBeenNthCalledWith(9, 'windowFollower.hide', {})
    expect(bridge.invoke).toHaveBeenNthCalledWith(10, 'windowFollower.quit', {})
    expect(bridge.on).toHaveBeenCalledWith('windowFollower.stateChanged', listener)
  })
})
