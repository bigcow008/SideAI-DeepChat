import { describe, expect, it, vi } from 'vitest'
import {
  excludeCurrentAppWithUpdate,
  removeExcludedAppWithUpdate
} from '@/windowFollower/core/adhesionExclusionFlow'
import type { ExcludedApp } from '@/windowFollower/core/adhesionExclusions'

describe('adhesion exclusion flow', () => {
  it('updates memory only after persistence succeeds and then refreshes the panel', async () => {
    let excludedApps: ExcludedApp[] = []
    const order: string[] = []

    await excludeCurrentAppWithUpdate({
      owner: { name: 'Code', bundleId: 'com.microsoft.VSCode' },
      getExcludedApps: () => excludedApps,
      setExcludedApps: (next) => {
        order.push('memory')
        excludedApps = next
      },
      persistExcludedApps: async () => {
        order.push('persist')
      },
      updatePanelPosition: async () => {
        order.push('panel')
      }
    })

    expect(order).toEqual(['persist', 'memory', 'panel'])
    expect(excludedApps).toHaveLength(1)
  })

  it('refreshes the panel after a persistence failure without changing memory', async () => {
    const original: ExcludedApp[] = []
    const setExcludedApps = vi.fn()
    const updatePanelPosition = vi.fn(async () => {})

    await expect(
      excludeCurrentAppWithUpdate({
        owner: { name: 'Code' },
        getExcludedApps: () => original,
        setExcludedApps,
        persistExcludedApps: async () => {
          throw new Error('disk full')
        },
        updatePanelPosition
      })
    ).rejects.toThrow('disk full')

    expect(setExcludedApps).not.toHaveBeenCalled()
    expect(updatePanelPosition).toHaveBeenCalledOnce()
  })

  it('removes an existing exclusion and refreshes the panel', async () => {
    const existing: ExcludedApp = {
      id: 'name:Code',
      matchType: 'name',
      name: 'Code',
      createdAt: '2026-07-12T00:00:00.000Z'
    }
    let excludedApps = [existing]

    await removeExcludedAppWithUpdate({
      id: existing.id,
      getExcludedApps: () => excludedApps,
      setExcludedApps: (next) => {
        excludedApps = next
      },
      persistExcludedApps: async () => {},
      updatePanelPosition: async () => {}
    })

    expect(excludedApps).toEqual([])
  })
})
