import {
  areDesktopPermissionGatesEqual,
  createPermissionSampler,
  type DesktopPermissions,
  type PermissionSample
} from './desktopCapability'

export type DesktopPermissionKey = 'accessibility' | 'screenRecording'

type DesktopPermissionServiceDependencies = {
  platform: NodeJS.Platform
  now?: () => number
  isTrustedAccessibilityClient: (prompt: boolean) => boolean
  getMediaAccessStatus: (mediaType: 'screen') => string
  openExternal: (url: string) => Promise<unknown>
}

const PERMISSION_CACHE_MS = 1_000
const MAC_PERMISSION_SETTINGS_URLS: Record<DesktopPermissionKey, string> = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screenRecording: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
}

function platformLabel(platform: NodeJS.Platform): DesktopPermissions['platform'] {
  if (platform === 'darwin') return 'macos'
  if (platform === 'win32') return 'windows'
  if (platform === 'linux') return 'linux'
  return 'other'
}

function stateFromRead(read: () => boolean): DesktopPermissions['accessibility'] {
  try {
    return read() ? 'granted' : 'missing'
  } catch {
    return 'unknown'
  }
}

export type DesktopPermissionService = {
  sample: (force?: boolean) => PermissionSample
  openSettings: (permission: DesktopPermissionKey) => Promise<PermissionSample>
}

export function createDesktopPermissionService(
  dependencies: DesktopPermissionServiceDependencies
): DesktopPermissionService {
  const now = dependencies.now ?? Date.now

  const read = (): DesktopPermissions => {
    const checkedAt = now()
    if (dependencies.platform !== 'darwin') {
      return {
        platform: platformLabel(dependencies.platform),
        accessibility: 'not-applicable',
        screenRecording: 'not-applicable',
        checkedAt
      }
    }

    const accessibility = stateFromRead(() => dependencies.isTrustedAccessibilityClient(false))
    const screenRecording = stateFromRead(
      () => dependencies.getMediaAccessStatus('screen') === 'granted'
    )
    return { platform: 'macos', accessibility, screenRecording, checkedAt }
  }

  const sampler = createPermissionSampler(
    read,
    PERMISSION_CACHE_MS,
    now,
    areDesktopPermissionGatesEqual
  )

  return {
    sample: (force = false) => sampler.sample(force),
    openSettings: async (permission) => {
      if (dependencies.platform === 'darwin') {
        if (permission === 'accessibility') {
          dependencies.isTrustedAccessibilityClient(true)
        }
        await dependencies.openExternal(MAC_PERMISSION_SETTINGS_URLS[permission])
      }
      return sampler.sample(true)
    }
  }
}
