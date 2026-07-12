import { describe, expect, it, vi } from 'vitest'
import { WindowContextService } from '@/windowFollower/windowContextService'
import type { DesktopPermissionService } from '@/windowFollower/desktopPermissionService'

const granted = {
  platform: 'macos' as const,
  accessibility: 'granted' as const,
  screenRecording: 'granted' as const,
  checkedAt: 1_000
}

const vscodeWindow = {
  platform: 'macos' as const,
  title: 'PRD.md - SideAI',
  id: 7,
  bounds: { x: 100, y: 80, width: 1200, height: 800 },
  owner: {
    name: 'Code',
    processId: 42,
    bundleId: 'com.microsoft.VSCode',
    path: '/Applications/Visual Studio Code.app'
  },
  memoryUsage: 1000
}

function permissionService(value = granted): DesktopPermissionService {
  return {
    sample: vi.fn(() => ({ value, revision: 1 })),
    openSettings: vi.fn()
  }
}

describe('WindowContextService', () => {
  it('does not call get-windows when either permission is missing', async () => {
    const missing = { ...granted, screenRecording: 'missing' as const }
    const readActiveWindow = vi.fn(async () => vscodeWindow)
    const service = new WindowContextService({
      permissionService: permissionService(missing),
      readActiveWindow,
      getPreference: () => true,
      ownProcessId: 99,
      ownAppName: 'DeepChat',
      now: () => 1_000
    })

    const result = await service.refresh()
    expect(readActiveWindow).not.toHaveBeenCalled()
    expect(result.snapshot).toBeNull()
    expect(result.automaticAdhesionAvailable).toBe(false)
  })

  it('creates a stable immutable snapshot for an external live window', async () => {
    const service = new WindowContextService({
      permissionService: permissionService(),
      readActiveWindow: async () => vscodeWindow,
      getPreference: () => true,
      ownProcessId: 99,
      ownAppName: 'DeepChat',
      now: () => 2_000
    })

    const result = await service.refresh()
    expect(result.snapshot).toMatchObject({
      schemaVersion: 1,
      source: 'active',
      freshness: 'live',
      capturedAt: 2_000,
      app: { stableKey: 'bundleId:com.microsoft.VSCode', processId: 42 },
      window: { windowId: 7, title: 'PRD.md - SideAI' }
    })
    expect(Object.isFrozen(result.snapshot)).toBe(true)
  })

  it('retains the last external target while SideAI itself is focused without refreshing capturedAt', async () => {
    let now = 2_000
    let current = vscodeWindow
    const service = new WindowContextService({
      permissionService: permissionService(),
      readActiveWindow: async () => current,
      getPreference: () => true,
      ownProcessId: 99,
      ownAppName: 'DeepChat',
      now: () => now
    })

    const live = await service.refresh()
    now = 2_080
    current = {
      ...vscodeWindow,
      id: 70,
      owner: { ...vscodeWindow.owner, name: 'DeepChat', processId: 99 }
    }
    const retained = await service.refresh()

    expect(retained.snapshot).toMatchObject({
      source: 'retained-while-sideai-focused',
      freshness: 'retained',
      capturedAt: live.snapshot?.capturedAt
    })
  })

  it('suppresses and clears an excluded application', async () => {
    const service = new WindowContextService({
      permissionService: permissionService(),
      readActiveWindow: async () => vscodeWindow,
      getPreference: () => true,
      ownProcessId: 99,
      ownAppName: 'DeepChat',
      now: () => 2_000
    })
    service.setExcludedApps([
      {
        id: 'bundleId:com.microsoft.VSCode',
        matchType: 'bundleId',
        name: 'Code',
        bundleId: 'com.microsoft.VSCode',
        createdAt: '2026-07-12T00:00:00.000Z'
      }
    ])

    const result = await service.refresh()
    expect(result.snapshot).toBeNull()
    expect(result.lastError).toBe('目标应用已排除')
  })
})
