import { describe, expect, it, vi } from 'vitest'
import {
  areDesktopPermissionGatesEqual,
  createPermissionSampler,
  deriveAutomaticAdhesion,
  readDesktopContextWhenAvailable
} from '@/windowFollower/desktopCapability'
import type { WindowContextSnapshot } from '@shared/windowFollower'

type Permissions = WindowContextSnapshot['permissions']

function permissions(
  accessibility: Permissions['accessibility'] = 'granted',
  screenRecording: Permissions['screenRecording'] = 'granted'
): Permissions {
  return { platform: 'macos', accessibility, screenRecording, checkedAt: 0 }
}

describe('desktop capability', () => {
  it('samples once inside the one-second TTL and forces an immediate refresh', () => {
    let now = 0
    const read = vi.fn(() => permissions())
    const sampler = createPermissionSampler(read, 1_000, () => now, areDesktopPermissionGatesEqual)

    const first = sampler.sample()
    now = 999
    expect(sampler.sample()).toBe(first)
    expect(read).toHaveBeenCalledOnce()

    const forced = sampler.sample(true)
    expect(read).toHaveBeenCalledTimes(2)
    expect(forced.revision).toBe(first.revision)
  })

  it('separates permission capability from the user automatic-adhesion preference', () => {
    expect(deriveAutomaticAdhesion(permissions(), false)).toEqual({
      canReadWindowContext: true,
      automaticAdhesionAvailable: false
    })
    expect(deriveAutomaticAdhesion(permissions('missing'), true)).toEqual({
      canReadWindowContext: false,
      automaticAdhesionAvailable: false
    })
    expect(
      deriveAutomaticAdhesion(
        {
          platform: 'windows',
          accessibility: 'not-applicable',
          screenRecording: 'not-applicable',
          checkedAt: 0
        },
        true
      )
    ).toEqual({
      canReadWindowContext: false,
      automaticAdhesionAvailable: false
    })
  })

  it('does not read context while either macOS permission is missing', async () => {
    const read = vi.fn(async () => ({ id: 7 }))
    const result = await readDesktopContextWhenAvailable({
      getPermissionSample: () => ({ value: permissions('granted', 'missing'), revision: 1 }),
      getPreference: () => true,
      read
    })

    expect(read).not.toHaveBeenCalled()
    expect(result.context).toBeNull()
  })

  it('discards an in-flight context when a newer permission revision appears', async () => {
    const granted = permissions()
    const missing = permissions('missing')
    let calls = 0
    const result = await readDesktopContextWhenAvailable({
      getPermissionSample: () => {
        calls += 1
        return calls === 1 ? { value: granted, revision: 1 } : { value: missing, revision: 2 }
      },
      getPreference: () => true,
      read: async () => ({ id: 'stale-target' })
    })

    expect(result.context).toBeNull()
    expect(result.canReadWindowContext).toBe(false)
  })
})
