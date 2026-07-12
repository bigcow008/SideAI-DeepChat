import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createAppIdentity,
  isOwnerExcluded,
  loadExcludedApps,
  saveExcludedApps,
  upsertExcludedApp
} from '@/windowFollower/core/adhesionExclusions'
import { loadAdhesionSettings, saveAdhesionSettings } from '@/windowFollower/core/adhesionSettings'

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sideai-window-follower-'))
  try {
    await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('application exclusions', () => {
  it('uses bundle id before path and name for stable identity', () => {
    expect(
      createAppIdentity({
        name: 'Code',
        bundleId: 'com.microsoft.VSCode',
        path: '/Applications/Visual Studio Code.app'
      })
    ).toMatchObject({ id: 'bundleId:com.microsoft.VSCode', matchType: 'bundleId' })
  })

  it('matches a lower-confidence saved path when richer owner data arrives', () => {
    const excludedApps = [
      {
        id: 'path:/Applications/FLClash.app',
        matchType: 'path' as const,
        name: 'FLClash',
        path: '/Applications/FLClash.app',
        createdAt: '2026-07-12T00:00:00.000Z'
      }
    ]
    expect(
      isOwnerExcluded(
        {
          name: 'FLClash',
          bundleId: 'com.flclash.app',
          path: '/Applications/FLClash.app'
        },
        excludedApps
      )
    ).toBe(true)
  })

  it('persists exclusions atomically', async () => {
    await withTempDir(async (dir) => {
      const filePath = path.join(dir, 'excluded.json')
      const result = upsertExcludedApp([], { name: 'Code' }, 1_700_000_000_000)
      await saveExcludedApps(filePath, result.excludedApps)
      expect(await loadExcludedApps(filePath)).toEqual(result.excludedApps)
    })
  })
})

describe('adhesion settings', () => {
  it('defaults automatic adhesion to enabled for missing or invalid data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await withTempDir(async (dir) => {
      const filePath = path.join(dir, 'settings.json')
      expect(await loadAdhesionSettings(filePath)).toEqual({ universalAdhesion: true })
      await writeFile(filePath, '{bad json', 'utf8')
      expect(await loadAdhesionSettings(filePath)).toEqual({ universalAdhesion: true })
    })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })

  it('persists the user pause preference', async () => {
    await withTempDir(async (dir) => {
      const filePath = path.join(dir, 'settings.json')
      await saveAdhesionSettings(filePath, { universalAdhesion: false })
      expect(await loadAdhesionSettings(filePath)).toEqual({ universalAdhesion: false })
    })
  })
})
