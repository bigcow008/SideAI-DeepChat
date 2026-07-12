import { describe, expect, it } from 'vitest'
import { WindowContextSnapshotSchema, WindowFollowerDebugDtoSchema } from '@shared/windowFollower'

const snapshot = {
  schemaVersion: 1,
  trackingState: 'following',
  source: 'active',
  freshness: 'live',
  capturedAt: 1_000,
  lastVerifiedAt: 1_010,
  app: {
    stableKey: 'bundleId:com.microsoft.VSCode',
    name: 'Code',
    bundleId: 'com.microsoft.VSCode',
    path: '/Applications/Visual Studio Code.app',
    processId: 42
  },
  window: {
    windowId: 7,
    title: 'SideAI',
    bounds: { x: 0, y: 0, width: 1200, height: 800 }
  },
  permissions: {
    platform: 'macos',
    accessibility: 'granted',
    screenRecording: 'granted',
    checkedAt: 1_010
  }
} as const

describe('window follower contracts', () => {
  it('accepts an immutable live window snapshot', () => {
    expect(WindowContextSnapshotSchema.parse(snapshot)).toEqual(snapshot)
  })

  it('rejects unknown snapshot fields', () => {
    expect(() => WindowContextSnapshotSchema.parse({ ...snapshot, secret: 'unexpected' })).toThrow()
  })

  it('requires unavailable debug state to omit the target snapshot', () => {
    const debug = WindowFollowerDebugDtoSchema.parse({
      mode: 'normal',
      snapshot: null,
      permissions: snapshot.permissions,
      panelBounds: null,
      displayBounds: [],
      placement: null,
      contentOffsetX: 0,
      lastError: 'permission missing',
      updatedAt: 1_020
    })
    expect(debug.snapshot).toBeNull()
  })
})
