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
import type {
  WindowFollowerDebugDto,
  WindowFollowerMode,
  WindowFollowerSettingsDto
} from '@shared/windowFollower'
import type {
  DesktopPermissionKey,
  DesktopPermissionService
} from '@/windowFollower/desktopPermissionService'

export type WindowFollowerRouteRuntime = {
  windowFollowerPresenter: {
    getDebugState: () => WindowFollowerDebugDto
    refresh: (forcePermissions?: boolean) => Promise<void>
    setMode: (mode: WindowFollowerMode) => boolean
    setCollapsed: (collapsed: boolean) => boolean
    setPanelWidth: (width: number) => boolean
    setContentPointerInteractive: (interactive: boolean) => boolean
    resetPanelWidth: () => boolean
    getSettings: () => WindowFollowerSettingsDto
    excludeCurrentApp: () => Promise<WindowFollowerSettingsDto>
    removeExcludedApp: (id: string) => Promise<WindowFollowerSettingsDto>
    hide: () => boolean
    quit: () => boolean
  }
  desktopPermissionService: Pick<DesktopPermissionService, 'openSettings'>
  getAutomaticAdhesion: () => boolean
  setAutomaticAdhesion: (enabled: boolean) => void
}

function state(runtime: WindowFollowerRouteRuntime) {
  return runtime.windowFollowerPresenter.getDebugState()
}

export async function dispatchWindowFollowerRoute(
  runtime: WindowFollowerRouteRuntime,
  routeName: string,
  rawInput: unknown
): Promise<unknown | undefined> {
  switch (routeName) {
    case windowFollowerGetStateRoute.name:
      windowFollowerGetStateRoute.input.parse(rawInput)
      return windowFollowerGetStateRoute.output.parse({ state: state(runtime) })
    case windowFollowerRefreshRoute.name:
      windowFollowerRefreshRoute.input.parse(rawInput)
      await runtime.windowFollowerPresenter.refresh(true)
      return windowFollowerRefreshRoute.output.parse({ state: state(runtime) })
    case windowFollowerSetModeRoute.name: {
      const input = windowFollowerSetModeRoute.input.parse(rawInput)
      runtime.windowFollowerPresenter.setMode(input.mode)
      return windowFollowerSetModeRoute.output.parse({ state: state(runtime) })
    }
    case windowFollowerSetCollapsedRoute.name: {
      const input = windowFollowerSetCollapsedRoute.input.parse(rawInput)
      runtime.windowFollowerPresenter.setCollapsed(input.collapsed)
      return windowFollowerSetCollapsedRoute.output.parse({ state: state(runtime) })
    }
    case windowFollowerSetWidthRoute.name: {
      const input = windowFollowerSetWidthRoute.input.parse(rawInput)
      runtime.windowFollowerPresenter.setPanelWidth(input.width)
      return windowFollowerSetWidthRoute.output.parse({ state: state(runtime) })
    }
    case windowFollowerSetPointerInteractiveRoute.name: {
      const input = windowFollowerSetPointerInteractiveRoute.input.parse(rawInput)
      runtime.windowFollowerPresenter.setContentPointerInteractive(input.interactive)
      return windowFollowerSetPointerInteractiveRoute.output.parse({ state: state(runtime) })
    }
    case windowFollowerSetAutomaticAdhesionRoute.name: {
      const input = windowFollowerSetAutomaticAdhesionRoute.input.parse(rawInput)
      runtime.setAutomaticAdhesion(input.enabled)
      await runtime.windowFollowerPresenter.refresh(true)
      return windowFollowerSetAutomaticAdhesionRoute.output.parse({ state: state(runtime) })
    }
    case windowFollowerOpenPermissionSettingsRoute.name: {
      const input = windowFollowerOpenPermissionSettingsRoute.input.parse(rawInput)
      await runtime.desktopPermissionService.openSettings(input.permission as DesktopPermissionKey)
      await runtime.windowFollowerPresenter.refresh(true)
      return windowFollowerOpenPermissionSettingsRoute.output.parse({ state: state(runtime) })
    }
    case windowFollowerResetWidthRoute.name:
      windowFollowerResetWidthRoute.input.parse(rawInput)
      runtime.windowFollowerPresenter.resetPanelWidth()
      return windowFollowerResetWidthRoute.output.parse({ state: state(runtime) })
    case windowFollowerGetSettingsRoute.name:
      windowFollowerGetSettingsRoute.input.parse(rawInput)
      return windowFollowerGetSettingsRoute.output.parse({
        settings: runtime.windowFollowerPresenter.getSettings()
      })
    case windowFollowerExcludeCurrentAppRoute.name: {
      windowFollowerExcludeCurrentAppRoute.input.parse(rawInput)
      const settings = await runtime.windowFollowerPresenter.excludeCurrentApp()
      return windowFollowerExcludeCurrentAppRoute.output.parse({
        settings,
        state: state(runtime)
      })
    }
    case windowFollowerRemoveExcludedAppRoute.name: {
      const input = windowFollowerRemoveExcludedAppRoute.input.parse(rawInput)
      const settings = await runtime.windowFollowerPresenter.removeExcludedApp(input.id)
      return windowFollowerRemoveExcludedAppRoute.output.parse({
        settings,
        state: state(runtime)
      })
    }
    case windowFollowerHideRoute.name:
      windowFollowerHideRoute.input.parse(rawInput)
      return windowFollowerHideRoute.output.parse({
        hidden: runtime.windowFollowerPresenter.hide()
      })
    case windowFollowerQuitRoute.name:
      windowFollowerQuitRoute.input.parse(rawInput)
      runtime.windowFollowerPresenter.quit()
      return windowFollowerQuitRoute.output.parse({ requested: true })
    default:
      return undefined
  }
}
