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
      collapsed: false,
      panelWidth: 360,
      automaticAdhesionAvailable: false,
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

  it('transfers complete panel state and rejects unknown or invalid fields', () => {
    const state = {
      mode: 'following' as const,
      collapsed: false,
      panelWidth: 360,
      automaticAdhesionAvailable: true,
      snapshot,
      permissions: snapshot.permissions,
      panelBounds: { x: 1204, y: 0, width: 404, height: 800 },
      displayBounds: [{ x: 0, y: 0, width: 1200, height: 900 }],
      placement: 'right' as const,
      contentOffsetX: 44,
      lastError: null,
      updatedAt: 1_020
    }

    expect(WindowFollowerDebugDtoSchema.parse(state)).toEqual(state)
    expect(() => WindowFollowerDebugDtoSchema.parse({ ...state, secret: true })).toThrow()
    expect(() => WindowFollowerDebugDtoSchema.parse({ ...state, panelWidth: 120 })).toThrow()
  })
})
