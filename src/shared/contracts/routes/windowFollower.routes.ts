import { z } from 'zod'
import { defineRouteContract } from '../common'
import { WindowFollowerDebugDtoSchema, WindowFollowerModeSchema } from '../../windowFollower'

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
