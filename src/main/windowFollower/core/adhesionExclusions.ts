import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type AppIdentityMatchType = 'bundleId' | 'path' | 'name'

export type AppIdentity = {
  id: string
  matchType: AppIdentityMatchType
  name: string
  bundleId?: string
  path?: string
}

export type ExcludedApp = AppIdentity & { createdAt: string }

type OwnerLike =
  | {
      name?: string
      bundleId?: string
      path?: string
    }
  | undefined
  | null

type UpsertExcludedAppResult = {
  changed: boolean
  excludedApps: ExcludedApp[]
  excludedApp: ExcludedApp | null
}

function clean(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function identityId(matchType: AppIdentityMatchType, value: string) {
  return `${matchType}:${value}`
}

function ownerMatchValue(owner: OwnerLike, matchType: AppIdentityMatchType) {
  if (matchType === 'bundleId') return clean(owner?.bundleId)
  if (matchType === 'path') return clean(owner?.path)
  return clean(owner?.name)
}

function ownerMatchesExcludedApp(owner: OwnerLike, excludedApp: ExcludedApp) {
  const matchValue = ownerMatchValue(owner, excludedApp.matchType)
  return (
    matchValue !== undefined && excludedApp.id === identityId(excludedApp.matchType, matchValue)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isExcludedApp(value: unknown): value is ExcludedApp {
  if (!isRecord(value)) return false
  const matchType = value.matchType
  return (
    typeof value.id === 'string' &&
    (matchType === 'bundleId' || matchType === 'path' || matchType === 'name') &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    (value.bundleId === undefined || typeof value.bundleId === 'string') &&
    (value.path === undefined || typeof value.path === 'string')
  )
}

function isMissingFileError(error: unknown) {
  return isRecord(error) && error.code === 'ENOENT'
}

export function createAppIdentity(owner: OwnerLike): AppIdentity | null {
  const name = clean(owner?.name)
  const bundleId = clean(owner?.bundleId)
  const ownerPath = clean(owner?.path)

  if (bundleId) {
    return {
      id: identityId('bundleId', bundleId),
      matchType: 'bundleId',
      name: name ?? bundleId,
      bundleId,
      path: ownerPath
    }
  }
  if (ownerPath) {
    return {
      id: identityId('path', ownerPath),
      matchType: 'path',
      name: name ?? path.basename(ownerPath),
      path: ownerPath
    }
  }
  if (name) return { id: identityId('name', name), matchType: 'name', name }
  return null
}

export function isOwnerExcluded(owner: OwnerLike, excludedApps: ExcludedApp[]) {
  return excludedApps.some((app) => ownerMatchesExcludedApp(owner, app))
}

export function upsertExcludedApp(
  excludedApps: ExcludedApp[],
  owner: OwnerLike,
  now = Date.now()
): UpsertExcludedAppResult {
  const identity = createAppIdentity(owner)
  if (!identity) return { changed: false, excludedApps, excludedApp: null }

  const existing = excludedApps.find((app) => ownerMatchesExcludedApp(owner, app))
  if (existing) return { changed: false, excludedApps, excludedApp: existing }

  const excludedApp: ExcludedApp = { ...identity, createdAt: new Date(now).toISOString() }
  return { changed: true, excludedApps: [...excludedApps, excludedApp], excludedApp }
}

export function removeExcludedApp(excludedApps: ExcludedApp[], id: string) {
  return excludedApps.filter((app) => app.id !== id)
}

export async function loadExcludedApps(filePath: string): Promise<ExcludedApp[]> {
  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch (error) {
    if (!isMissingFileError(error))
      console.warn(`Failed to read adhesion exclusions from ${filePath}`, error)
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isExcludedApp)) {
      console.warn(`Invalid adhesion exclusions in ${filePath}`)
      return []
    }
    return parsed
  } catch (error) {
    console.warn(`Invalid adhesion exclusions JSON in ${filePath}`, error)
    return []
  }
}

export async function saveExcludedApps(filePath: string, excludedApps: ExcludedApp[]) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tempPath, `${JSON.stringify(excludedApps, null, 2)}\n`, 'utf8')
  await rename(tempPath, filePath)
}
