import { ref, toValue, type MaybeRefOrGetter } from 'vue'
import { describe, expect, it, vi } from 'vitest'

describe('useOnBoarding container viewport', () => {
  it('uses the nearest panel surface as the fixed overlay viewport', async () => {
    vi.resetModules()

    const surface = document.createElement('div')
    surface.dataset.windowFollowerSurface = 'panel'
    const container = document.createElement('div')
    const target = document.createElement('button')
    container.appendChild(target)
    surface.appendChild(container)
    document.body.appendChild(surface)

    vi.doMock('@vueuse/core', () => ({
      useElementSize: (source: MaybeRefOrGetter<Element | null>) => {
        const element = toValue(source)
        if (element === null) return { width: ref(0), height: ref(0) }
        if (element === surface) {
          return { width: ref(316), height: ref(800) }
        }
        return element === container
          ? { width: ref(300), height: ref(720) }
          : { width: ref(360), height: ref(800) }
      },
      useElementBounding: (source: MaybeRefOrGetter<Element | null>) => {
        const element = toValue(source)
        const rect =
          element === surface
            ? { x: 44, y: 0, width: 316, height: 800 }
            : element === container
              ? { x: 52, y: 40, width: 300, height: 720 }
              : { x: 144, y: 100, width: 100, height: 50 }
        return {
          ...Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, ref(value)])),
          update: vi.fn()
        }
      }
    }))

    const { useOnBoarding } = await import('@/composables/useOnBoarding')
    const onboarding = (
      useOnBoarding as (
        targetEl: () => HTMLElement,
        options: {
          containerEl: () => HTMLElement
          visible: boolean
        }
      ) => ReturnType<typeof useOnBoarding>
    )(() => target, {
      containerEl: () => container,
      visible: true
    })

    expect(onboarding.viewportWidth.value).toBe(316)
    expect(onboarding.spotlightRect.value).toEqual({
      x: 88,
      y: 88,
      width: 124,
      height: 74
    })
    expect(onboarding.pathD.value).toContain('M316,0')

    const fallback = (
      useOnBoarding as (
        targetEl: () => HTMLElement,
        options: {
          containerEl: () => HTMLElement | null
          visible: boolean
        }
      ) => ReturnType<typeof useOnBoarding>
    )(() => target, {
      containerEl: () => null,
      visible: true
    })

    expect(fallback.viewportWidth.value).toBe(360)

    surface.remove()
  })
})
