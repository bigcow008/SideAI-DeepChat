import { z } from 'zod'

export const BoundsSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative()
})

export type Bounds = z.infer<typeof BoundsSchema>

export const WindowFollowerModeSchema = z.enum(['following', 'fixed', 'detached', 'normal'])
export type WindowFollowerMode = z.infer<typeof WindowFollowerModeSchema>

export const TargetFreshnessSchema = z.enum(['live', 'retained', 'grace', 'unavailable'])
export type TargetFreshness = z.infer<typeof TargetFreshnessSchema>

export const WindowContextSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  trackingState: WindowFollowerModeSchema,
  source: z.enum(['active', 'retained-while-sideai-focused', 'last-known', 'none']),
  freshness: TargetFreshnessSchema,
  capturedAt: z.number(),
  lastVerifiedAt: z.number(),
  app: z.strictObject({
    stableKey: z.string().min(1),
    name: z.string().min(1),
    bundleId: z.string().optional(),
    path: z.string().optional(),
    processId: z.number().int().nonnegative()
  }),
  window: z.strictObject({
    windowId: z.number().int().nonnegative(),
    title: z.string(),
    bounds: BoundsSchema
  }),
  permissions: z.strictObject({
    platform: z.enum(['macos', 'windows', 'linux', 'other', 'unknown']),
    accessibility: z.enum(['granted', 'missing', 'unknown', 'not-applicable']),
    screenRecording: z.enum(['granted', 'missing', 'unknown', 'not-applicable']),
    checkedAt: z.number()
  })
})

export type WindowContextSnapshot = z.infer<typeof WindowContextSnapshotSchema>

export const WindowFollowerDebugDtoSchema = z.strictObject({
  mode: WindowFollowerModeSchema,
  snapshot: WindowContextSnapshotSchema.nullable(),
  permissions: WindowContextSnapshotSchema.shape.permissions,
  panelBounds: BoundsSchema.nullable(),
  displayBounds: z.array(BoundsSchema),
  placement: z.enum(['right', 'screen-right', 'rail-right']).nullable(),
  contentOffsetX: z.number(),
  lastError: z.string().nullable(),
  updatedAt: z.number()
})

export type WindowFollowerDebugDto = z.infer<typeof WindowFollowerDebugDtoSchema>
