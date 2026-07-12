import type { WindowContextSnapshot } from '@shared/windowFollower'
import type { DesktopPermissionService } from './desktopPermissionService'
import { readDesktopContextWhenAvailable } from './desktopCapability'
import type { WindowSnapshot, WindowReadPermissions } from './getWindowsAdapter'
import {
  recordLiveTarget,
  recordTargetMiss,
  recordTargetUnavailable,
  retainTargetWhileSelfFocused,
  type TargetState
} from './core/targetTracker'
import { createAppIdentity, isOwnerExcluded, type ExcludedApp } from './core/adhesionExclusions'

type WindowContextServiceDependencies = {
  permissionService: DesktopPermissionService
  readActiveWindow: (permissions: WindowReadPermissions) => Promise<WindowSnapshot | null>
  getPreference: () => boolean
  ownProcessId: number
  ownAppName: string
  now?: () => number
}

export type WindowContextRefreshResult = {
  permissions: WindowContextSnapshot['permissions']
  canReadWindowContext: boolean
  automaticAdhesionAvailable: boolean
  snapshot: WindowContextSnapshot | null
  lastError: string | null
}

const TARGET_GRACE_MS = 1_000

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const nested of Object.values(value)) deepFreeze(nested)
  return Object.freeze(value)
}

export class WindowContextService {
  private targetState: TargetState<WindowSnapshot> = {
    target: null,
    freshness: 'unavailable',
    capturedAt: null,
    error: null
  }
  private excludedApps: ExcludedApp[] = []
  private readonly now: () => number

  constructor(private readonly dependencies: WindowContextServiceDependencies) {
    this.now = dependencies.now ?? Date.now
  }

  setExcludedApps(excludedApps: ExcludedApp[]) {
    this.excludedApps = [...excludedApps]
  }

  async refresh(forcePermissions = false): Promise<WindowContextRefreshResult> {
    const capability = await readDesktopContextWhenAvailable({
      getPermissionSample: () => this.dependencies.permissionService.sample(forcePermissions),
      getPreference: this.dependencies.getPreference,
      read: (permissions) =>
        this.dependencies.readActiveWindow({
          accessibilityPermission: permissions.accessibility === 'granted',
          screenRecordingPermission: permissions.screenRecording === 'granted'
        })
    })

    if (!capability.canReadWindowContext) {
      this.targetState = recordTargetUnavailable(this.targetState, '窗口读取权限不足')
      return { ...capability, snapshot: null, lastError: this.targetState.error }
    }

    const current = capability.context
    if (!current) {
      this.targetState = recordTargetMiss(
        this.targetState,
        this.now(),
        '未读取到活跃窗口',
        TARGET_GRACE_MS
      )
    } else if (this.isOwnWindow(current)) {
      this.targetState = retainTargetWhileSelfFocused(this.targetState)
    } else if (isOwnerExcluded(current.owner, this.excludedApps)) {
      this.targetState = recordTargetUnavailable(this.targetState, '目标应用已排除')
    } else {
      this.targetState = recordLiveTarget(current, this.now())
    }

    return {
      ...capability,
      snapshot: this.buildSnapshot(capability.permissions),
      lastError: this.targetState.error
    }
  }

  private isOwnWindow(windowInfo: WindowSnapshot) {
    return (
      windowInfo.owner.processId === this.dependencies.ownProcessId ||
      windowInfo.owner.name.toLowerCase().includes(this.dependencies.ownAppName.toLowerCase())
    )
  }

  private buildSnapshot(
    permissions: WindowContextSnapshot['permissions']
  ): WindowContextSnapshot | null {
    const target = this.targetState.target
    const capturedAt = this.targetState.capturedAt
    if (!target || capturedAt === null) return null

    const identity = createAppIdentity(target.owner)
    if (!identity) return null

    const source =
      this.targetState.freshness === 'live'
        ? 'active'
        : this.targetState.freshness === 'retained'
          ? 'retained-while-sideai-focused'
          : 'last-known'

    return deepFreeze({
      schemaVersion: 1,
      trackingState: 'following',
      source,
      freshness: this.targetState.freshness,
      capturedAt,
      lastVerifiedAt: capturedAt,
      app: {
        stableKey: identity.id,
        name: identity.name,
        bundleId: identity.bundleId,
        path: identity.path,
        processId: target.owner.processId
      },
      window: {
        windowId: target.id,
        title: target.title ?? '',
        bounds: { ...target.bounds }
      },
      permissions
    })
  }
}
