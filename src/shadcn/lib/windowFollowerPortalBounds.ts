import {
  computed,
  inject,
  provide,
  toValue,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter
} from 'vue'

type CollisionSide = 'top' | 'right' | 'bottom' | 'left'
type CollisionPadding = number | Partial<Record<CollisionSide, number>>

interface WindowFollowerPortalBoundsContext {
  isPanelMode: ComputedRef<boolean>
  contentOffsetX: ComputedRef<number>
}

const DEFAULT_PANEL_GUTTER = 8
const WINDOW_FOLLOWER_PORTAL_BOUNDS_KEY: InjectionKey<WindowFollowerPortalBoundsContext> = Symbol(
  'window-follower-portal-bounds'
)

export function provideWindowFollowerPortalBounds(context: WindowFollowerPortalBoundsContext): void {
  provide(WINDOW_FOLLOWER_PORTAL_BOUNDS_KEY, context)
}

export function useWindowFollowerCollisionPadding(
  padding: MaybeRefOrGetter<CollisionPadding | undefined>
): ComputedRef<CollisionPadding | undefined> {
  const context = inject(WINDOW_FOLLOWER_PORTAL_BOUNDS_KEY, null)

  return computed(() => {
    const requestedPadding = toValue(padding)
    if (!context?.isPanelMode.value) return requestedPadding

    const reserve = Math.max(0, context.contentOffsetX.value)
    if (typeof requestedPadding === 'number') {
      return {
        top: requestedPadding,
        right: requestedPadding,
        bottom: requestedPadding,
        left: reserve + requestedPadding
      }
    }

    if (requestedPadding) {
      return {
        top: requestedPadding.top ?? 0,
        right: requestedPadding.right ?? 0,
        bottom: requestedPadding.bottom ?? 0,
        left: reserve + (requestedPadding.left ?? 0)
      }
    }

    return {
      top: DEFAULT_PANEL_GUTTER,
      right: DEFAULT_PANEL_GUTTER,
      bottom: DEFAULT_PANEL_GUTTER,
      left: reserve + DEFAULT_PANEL_GUTTER
    }
  })
}
