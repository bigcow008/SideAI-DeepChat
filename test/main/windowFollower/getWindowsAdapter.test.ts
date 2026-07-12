import { describe, expect, it, vi } from 'vitest'
import {
  readActiveWindowFromReaders,
  readActiveWindowWithBoundsFallback,
  selectBestTargetWindow
} from '@/windowFollower/getWindowsAdapter'

const snapshot = {
  platform: 'macos',
  title: '',
  id: 123,
  bounds: { x: -42, y: 38, width: 1728, height: 1004 },
  owner: {
    name: 'Code',
    processId: 92991,
    bundleId: 'com.microsoft.VSCode',
    path: '/Applications/Visual Studio Code.app'
  },
  memoryUsage: 1000
}

describe('GetWindowsAdapter', () => {
  it('falls back from strict permissions to bounds-only reads', async () => {
    const reader = vi.fn(async (options) => {
      if (options.accessibilityPermission || options.screenRecordingPermission) {
        throw new Error('permission missing')
      }
      return snapshot
    })

    await expect(
      readActiveWindowWithBoundsFallback(reader, {
        accessibilityPermission: true,
        screenRecordingPermission: true
      })
    ).resolves.toEqual(snapshot)
    expect(reader).toHaveBeenCalledTimes(3)
  })

  it('replaces a context-menu-like active window with the largest same-owner window', async () => {
    const popup = { ...snapshot, id: 333, bounds: { x: 930, y: 210, width: 360, height: 420 } }
    const main = {
      ...snapshot,
      id: 444,
      title: 'SideAI - Visual Studio Code',
      bounds: { x: 120, y: 80, width: 1180, height: 820 }
    }

    expect(selectBestTargetWindow(popup, [popup, main])?.id).toBe(main.id)
    await expect(
      readActiveWindowFromReaders(
        async () => popup,
        async () => [popup, main],
        { accessibilityPermission: true, screenRecordingPermission: true }
      )
    ).resolves.toEqual(main)
  })

  it('does not replace a normal secondary window that is not clearly transient', () => {
    const secondary = {
      ...snapshot,
      id: 666,
      title: 'Search Results',
      bounds: { x: 220, y: 160, width: 860, height: 640 }
    }
    const main = {
      ...snapshot,
      id: 777,
      title: 'SideAI - Visual Studio Code',
      bounds: { x: 120, y: 80, width: 1180, height: 820 }
    }
    expect(selectBestTargetWindow(secondary, [secondary, main])?.id).toBe(secondary.id)
  })
})
