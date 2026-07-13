import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type StoredAdhesionSettings = {
  universalAdhesion: boolean
}

const defaultSettings: StoredAdhesionSettings = { universalAdhesion: true }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeAdhesionSettings(value: unknown): StoredAdhesionSettings {
  if (!isRecord(value) || typeof value.universalAdhesion !== 'boolean') return defaultSettings
  return { universalAdhesion: value.universalAdhesion }
}

function isMissingFileError(error: unknown) {
  return isRecord(error) && error.code === 'ENOENT'
}

export async function loadAdhesionSettings(filePath: string): Promise<StoredAdhesionSettings> {
  try {
    const raw = await readFile(filePath, 'utf8')
    return normalizeAdhesionSettings(JSON.parse(raw))
  } catch (error) {
    if (!isMissingFileError(error))
      console.warn(`Invalid adhesion settings JSON in ${filePath}`, error)
    return defaultSettings
  }
}

export async function saveAdhesionSettings(filePath: string, settings: StoredAdhesionSettings) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  await writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}
