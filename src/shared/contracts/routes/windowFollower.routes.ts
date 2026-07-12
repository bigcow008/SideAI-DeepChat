import { z } from 'zod'
import { defineRouteContract } from '../common'
import {
  WindowFollowerDebugDtoSchema,
  WindowFollowerModeSchema,
  WindowFollowerSettingsDtoSchema
} from '../../windowFollower'

const emptyInput = z.strictObject({})
const stateOutput = z.strictObject({ state: WindowFollowerDebugDtoSchema })

export const windowFollowerGetStateRoute = defineRouteContract({
  name: 'windowFollower.getState',
  input: emptyInput,
  output: stateOutput
})

export const windowFollowerRefreshRoute = defineRouteContract({
  name: 'windowFollower.refresh',
  input: emptyInput,
  output: stateOutput
})

export const windowFollowerSetModeRoute = defineRouteContract({
  name: 'windowFollower.setMode',
  input: z.strictObject({ mode: WindowFollowerModeSchema }),
  output: stateOutput
})

export const windowFollowerSetCollapsedRoute = defineRouteContract({
  name: 'windowFollower.setCollapsed',
  input: z.strictObject({ collapsed: z.boolean() }),
  output: stateOutput
})

export const windowFollowerSetWidthRoute = defineRouteContract({
  name: 'windowFollower.setWidth',
  input: z.strictObject({ width: z.number().finite().min(230) }),
  output: stateOutput
})

export const windowFollowerSetPointerInteractiveRoute = defineRouteContract({
  name: 'windowFollower.setPointerInteractive',
  input: z.strictObject({ interactive: z.boolean() }),
  output: stateOutput
})

export const windowFollowerSetAutomaticAdhesionRoute = defineRouteContract({
  name: 'windowFollower.setAutomaticAdhesion',
  input: z.strictObject({ enabled: z.boolean() }),
  output: stateOutput
})

export const windowFollowerOpenPermissionSettingsRoute = defineRouteContract({
  name: 'windowFollower.openPermissionSettings',
  input: z.strictObject({ permission: z.enum(['accessibility', 'screenRecording']) }),
  output: stateOutput
})

export const windowFollowerResetWidthRoute = defineRouteContract({
  name: 'windowFollower.resetWidth',
  input: emptyInput,
  output: stateOutput
})

export const windowFollowerGetSettingsRoute = defineRouteContract({
  name: 'windowFollower.getSettings',
  input: emptyInput,
  output: z.strictObject({ settings: WindowFollowerSettingsDtoSchema })
})

export const windowFollowerExcludeCurrentAppRoute = defineRouteContract({
  name: 'windowFollower.excludeCurrentApp',
  input: emptyInput,
  output: z.strictObject({
    settings: WindowFollowerSettingsDtoSchema,
    state: WindowFollowerDebugDtoSchema
  })
})

export const windowFollowerRemoveExcludedAppRoute = defineRouteContract({
  name: 'windowFollower.removeExcludedApp',
  input: z.strictObject({ id: z.string().min(1) }),
  output: z.strictObject({
    settings: WindowFollowerSettingsDtoSchema,
    state: WindowFollowerDebugDtoSchema
  })
})

export const windowFollowerHideRoute = defineRouteContract({
  name: 'windowFollower.hide',
  input: emptyInput,
  output: z.strictObject({ hidden: z.boolean() })
})

export const windowFollowerQuitRoute = defineRouteContract({
  name: 'windowFollower.quit',
  input: emptyInput,
  output: z.strictObject({ requested: z.literal(true) })
})
