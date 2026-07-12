import type { DeepchatBridge } from '@shared/contracts/bridge'
import {
  windowFollowerExcludeCurrentAppRoute,
  windowFollowerGetStateRoute,
  windowFollowerGetSettingsRoute,
  windowFollowerHideRoute,
  windowFollowerOpenPermissionSettingsRoute,
  windowFollowerQuitRoute,
  windowFollowerRefreshRoute,
  windowFollowerRemoveExcludedAppRoute,
  windowFollowerResetWidthRoute,
  windowFollowerSetAutomaticAdhesionRoute,
  windowFollowerSetCollapsedRoute,
  windowFollowerSetModeRoute,
  windowFollowerSetPointerInteractiveRoute,
  windowFollowerSetWidthRoute
} from '@shared/contracts/routes'
import type { WindowFollowerDebugDto, WindowFollowerMode } from '@shared/windowFollower'
import {
  windowFollowerStateChangedEvent,
  type DeepchatEventPayload
} from '@shared/contracts/events'
import { getDeepchatBridge } from './core'

export function createWindowFollowerClient(bridge: DeepchatBridge = getDeepchatBridge()) {
  const invokeState = async (routeName: string, input: unknown) => {
    const result = (await bridge.invoke(routeName as never, input as never)) as { state: unknown }
    return result.state as WindowFollowerDebugDto
  }

  return {
    getState: () => invokeState(windowFollowerGetStateRoute.name, {}),
    refresh: () => invokeState(windowFollowerRefreshRoute.name, {}),
    setMode: (mode: WindowFollowerMode) => invokeState(windowFollowerSetModeRoute.name, { mode }),
    setCollapsed: (collapsed: boolean) =>
      invokeState(windowFollowerSetCollapsedRoute.name, { collapsed }),
    setWidth: (width: number) => invokeState(windowFollowerSetWidthRoute.name, { width }),
    setPointerInteractive: (interactive: boolean) =>
      invokeState(windowFollowerSetPointerInteractiveRoute.name, { interactive }),
    setAutomaticAdhesion: (enabled: boolean) =>
      invokeState(windowFollowerSetAutomaticAdhesionRoute.name, { enabled }),
    openPermissionSettings: (permission: 'accessibility' | 'screenRecording') =>
      invokeState(windowFollowerOpenPermissionSettingsRoute.name, { permission }),
    resetWidth: () => invokeState(windowFollowerResetWidthRoute.name, {}),
    getSettings: async () => {
      const result = await bridge.invoke(windowFollowerGetSettingsRoute.name, {})
      return result.settings
    },
    excludeCurrentApp: () => bridge.invoke(windowFollowerExcludeCurrentAppRoute.name, {}),
    removeExcludedApp: (id: string) =>
      bridge.invoke(windowFollowerRemoveExcludedAppRoute.name, { id }),
    hide: async () => {
      const result = await bridge.invoke(windowFollowerHideRoute.name, {})
      return result.hidden
    },
    quit: async () => {
      const result = await bridge.invoke(windowFollowerQuitRoute.name, {})
      return result.requested
    },
    onStateChanged: (
      listener: (state: DeepchatEventPayload<'windowFollower.stateChanged'>) => void
    ) => bridge.on(windowFollowerStateChangedEvent.name, listener)
  }
}

export type WindowFollowerClient = ReturnType<typeof createWindowFollowerClient>
