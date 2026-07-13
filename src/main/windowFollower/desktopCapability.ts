import type { WindowContextSnapshot } from '@shared/windowFollower'

export type DesktopPermissions = WindowContextSnapshot['permissions']

export type PermissionSample<T = DesktopPermissions> = {
  value: T
  revision: number
}

export function areDesktopPermissionGatesEqual(
  left: DesktopPermissions,
  right: DesktopPermissions
) {
  return (
    left.platform === right.platform &&
    left.accessibility === right.accessibility &&
    left.screenRecording === right.screenRecording
  )
}

export function createPermissionSampler<T>(
  read: () => T,
  ttlMs: number,
  now: () => number = Date.now,
  isEqual: (left: T, right: T) => boolean = Object.is
) {
  let cached: PermissionSample<T> | null = null
  let sampledAt = 0

  return {
    sample(force = false): PermissionSample<T> {
      const currentTime = now()
      if (!force && cached && currentTime - sampledAt < ttlMs) return cached

      const value = read()
      const revision = cached ? cached.revision + (isEqual(cached.value, value) ? 0 : 1) : 1
      cached = { value, revision }
      sampledAt = currentTime
      return cached
    }
  }
}

export function hasRequiredDesktopPermissions(status: DesktopPermissions) {
  if (status.platform !== 'macos') return false
  return status.accessibility === 'granted' && status.screenRecording === 'granted'
}

export function deriveAutomaticAdhesion(status: DesktopPermissions, preference: boolean) {
  const canReadWindowContext = hasRequiredDesktopPermissions(status)
  return {
    canReadWindowContext,
    automaticAdhesionAvailable: canReadWindowContext && preference
  }
}

type DesktopContextReadOptions<T> = {
  getPermissionSample: () => PermissionSample
  getPreference: () => boolean
  read: (permissions: DesktopPermissions) => Promise<T | null>
}

export async function readDesktopContextWhenAvailable<T>({
  getPermissionSample,
  getPreference,
  read
}: DesktopContextReadOptions<T>) {
  const initialSample = getPermissionSample()
  const initialPermissions = initialSample.value
  const initialCapability = deriveAutomaticAdhesion(initialPermissions, getPreference())

  if (!initialCapability.canReadWindowContext) {
    return { permissions: initialPermissions, ...initialCapability, context: null }
  }

  const context = await read(initialPermissions)
  const currentSample = getPermissionSample()
  const permissions = currentSample.value
  const capability = deriveAutomaticAdhesion(permissions, getPreference())
  const permissionSampleIsCurrent = currentSample.revision === initialSample.revision

  return {
    permissions,
    ...capability,
    context: capability.canReadWindowContext && permissionSampleIsCurrent ? context : null
  }
}
