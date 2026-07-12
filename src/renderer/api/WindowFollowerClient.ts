import type { DeepchatBridge } from '@shared/contracts/bridge'
import {
  windowFollowerGetStateRoute,
  windowFollowerOpenPermissionSettingsRoute,
  windowFollowerRefreshRoute,
  windowFollowerSetAutomaticAdhesionRoute,
  windowFollowerSetCollapsedRoute,
  windowFollowerSetModeRoute,
  windowFollowerSetPointerInteractiveRoute,
  windowFollowerSetWidthRoute
} from '@shared/contracts/routes'
import type { WindowFollowerMode } from '@shared/windowFollower'
import {
  windowFollowerStateChangedEvent,
  type DeepchatEventPayload
} from '@shared/contracts/events'
import { getDeepchatBridge } from './core'

export function createWindowFollowerClient(bridge: DeepchatBridge = getDeepchatBridge()) {
  const invokeState = async (routeName: string, input: unknown) => {
    const result = (await bridge.invoke(routeName as never, input as never)) as { state: unknown }
    return result.state
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
    onStateChanged: (
      listener: (state: DeepchatEventPayload<'windowFollower.stateChanged'>) => void
    ) => bridge.on(windowFollowerStateChangedEvent.name, listener)
  }
}

export type WindowFollowerClient = ReturnType<typeof createWindowFollowerClient>
