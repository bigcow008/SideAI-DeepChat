import { describe, expect, it, vi } from 'vitest'
import type { DeepchatBridge } from '@shared/contracts/bridge'
import { createWindowFollowerClient } from '../../../src/renderer/api/WindowFollowerClient'

describe('WindowFollowerClient', () => {
  it('uses the typed DeepChat bridge for WindowFollower commands', async () => {
    const state = { mode: 'normal' }
    const bridge = {
      invoke: vi.fn(async (routeName: string) =>
        routeName === 'windowFollower.getState' ? { state } : { state }
      ),
      on: vi.fn(() => vi.fn())
    } as unknown as DeepchatBridge
    const client = createWindowFollowerClient(bridge)

    await expect(client.getState()).resolves.toBe(state)
    await client.setMode('fixed')
    await client.setCollapsed(true)
    await client.openPermissionSettings('screenRecording')
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
    expect(bridge.on).toHaveBeenCalledWith('windowFollower.stateChanged', listener)
  })
})
