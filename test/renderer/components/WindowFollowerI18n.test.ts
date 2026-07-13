import type { readFileSync as ReadFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const readText = async (path: string) => {
  const { readFileSync } = await vi.importActual<{ readFileSync: typeof ReadFileSync }>('node:fs')
  return readFileSync(path, 'utf8')
}

const componentPaths = [
  'WindowFollowerToolbar.vue',
  'WindowFollowerCollapsedBubble.vue',
  'WindowFollowerResizeHandle.vue',
  'WindowFollowerSessionControls.vue',
  'WindowFollowerSettingsPanel.vue',
  'WindowFollowerHistoryOverlay.vue'
]

const collectLeafPaths = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix]

  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, child]) => collectLeafPaths(child, prefix ? `${prefix}.${key}` : key))
    .sort()
}

describe('WindowFollower i18n', () => {
  it('routes every WindowFollower user-facing label through chat.windowFollower', async () => {
    for (const fileName of componentPaths) {
      const source = await readText(resolve('src/renderer/src/components/windowFollower', fileName))

      expect(source, fileName).not.toMatch(/[\u4e00-\u9fff]/)
      expect(source, fileName).toContain('chat.windowFollower')
    }
  })

  it('defines the same complete WindowFollower catalog for every locale', async () => {
    const { readdirSync } = await vi.importActual<typeof import('node:fs')>('node:fs')
    const localesRoot = resolve('src/renderer/src/i18n')
    const locales = readdirSync(localesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const sourceMessages = JSON.parse(
      await readText(resolve(localesRoot, 'zh-CN', 'chat.json'))
    ) as {
      windowFollower: Record<string, unknown>
    }
    const sourceLeafPaths = collectLeafPaths(sourceMessages.windowFollower)

    expect(locales).toHaveLength(20)
    expect(sourceLeafPaths).toHaveLength(47)

    for (const locale of locales) {
      const messages = JSON.parse(await readText(resolve(localesRoot, locale, 'chat.json'))) as {
        windowFollower: Record<string, unknown>
      }
      const leafPaths = collectLeafPaths(messages.windowFollower)

      expect(leafPaths, `${locale} WindowFollower leaf shape`).toEqual(sourceLeafPaths)
      for (const leafPath of leafPaths) {
        const value = leafPath.split('.').reduce<unknown>((current, key) => {
          if (!current || typeof current !== 'object') return undefined
          return (current as Record<string, unknown>)[key]
        }, messages.windowFollower)
        expect(value, `${locale}: ${leafPath}`).toEqual(expect.any(String))
        expect((value as string).trim(), `${locale}: ${leafPath}`).not.toBe('')
      }
    }
  })
})
