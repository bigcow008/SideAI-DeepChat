import { mount } from '@vue/test-utils'
import type { readFileSync as ReadFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, h, type Component } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import WindowFollowerSurface from '@/components/windowFollower/WindowFollowerSurface.vue'
import PopoverContent from '@shadcn/components/ui/popover/PopoverContent.vue'
import DropdownMenuContent from '@shadcn/components/ui/dropdown-menu/DropdownMenuContent.vue'
import DropdownMenuSubContent from '@shadcn/components/ui/dropdown-menu/DropdownMenuSubContent.vue'
import SelectContent from '@shadcn/components/ui/select/SelectContent.vue'
import TooltipContent from '@shadcn/components/ui/tooltip/TooltipContent.vue'

vi.mock('reka-ui', async () => {
  const actual = await vi.importActual<typeof import('reka-ui')>('reka-ui')
  const { defineComponent: defineVueComponent, h: createVNode } = await import('vue')
  const passthrough = (name: string) =>
    defineVueComponent({
      name,
      setup(_, { slots }) {
        return () => createVNode('div', slots.default?.())
      }
    })
  const collisionContent = (name: string) =>
    defineVueComponent({
      name,
      inheritAttrs: false,
      props: {
        collisionPadding: {
          type: [Number, Object],
          default: undefined
        }
      },
      setup(props) {
        return () =>
          createVNode('div', {
            'data-testid': 'reka-floating-content',
            'data-collision-padding': JSON.stringify(props.collisionPadding)
          })
      }
    })

  return {
    ...actual,
    PopoverPortal: passthrough('PopoverPortal'),
    PopoverContent: collisionContent('PopoverContent'),
    DropdownMenuPortal: passthrough('DropdownMenuPortal'),
    DropdownMenuContent: collisionContent('DropdownMenuContent'),
    DropdownMenuSubContent: collisionContent('DropdownMenuSubContent'),
    SelectPortal: passthrough('SelectPortal'),
    SelectContent: collisionContent('SelectContent'),
    SelectViewport: passthrough('SelectViewport'),
    TooltipPortal: passthrough('TooltipPortal'),
    TooltipContent: collisionContent('TooltipContent')
  }
})

const mountContent = (
  content: Component,
  options: {
    mode?: 'normal' | 'following'
    contentOffsetX?: number
    collisionPadding?: number
  } = {}
) => {
  const Harness = defineComponent({
    setup() {
      return () =>
        h(
          WindowFollowerSurface,
          {
            mode: options.mode ?? 'following',
            collapsed: false,
            contentOffsetX: options.contentOffsetX ?? 44
          },
          {
            default: () =>
              h(content, {
                collisionPadding: options.collisionPadding
              })
          }
        )
    }
  })

  const wrapper = mount(Harness)
  const value = wrapper
    .get('[data-testid="reka-floating-content"]')
    .attributes('data-collision-padding')

  wrapper.unmount()
  return value === undefined ? undefined : JSON.parse(value)
}

describe('WindowFollower floating portal bounds', () => {
  it.each([
    ['popover', PopoverContent],
    ['dropdown', DropdownMenuContent],
    ['dropdown submenu', DropdownMenuSubContent],
    ['select', SelectContent],
    ['tooltip', TooltipContent]
  ])('keeps %s inside the real panel content boundary', (_name, content) => {
    expect(mountContent(content)).toEqual({
      top: 8,
      right: 8,
      bottom: 8,
      left: 52
    })
  })

  it('adds an explicit collision gutter to the transparent reserve', () => {
    expect(mountContent(PopoverContent, { collisionPadding: 12 })).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 56
    })
  })

  it('preserves the native collision padding outside panel mode', () => {
    expect(
      mountContent(PopoverContent, {
        mode: 'normal',
        contentOffsetX: 0,
        collisionPadding: 12
      })
    ).toBe(12)
  })

  it('combines local floating size caps with the real panel viewport', async () => {
    const { readFileSync } = await vi.importActual<{ readFileSync: typeof ReadFileSync }>('node:fs')
    const styleCss = readFileSync(resolve('src/renderer/src/assets/style.css'), 'utf8')
    const chatStatusBar = readFileSync(
      resolve('src/renderer/src/components/chat/ChatStatusBar.vue'),
      'utf8'
    )
    const scrollablePopover = readFileSync(
      resolve('src/renderer/src/components/ScrollablePopover.vue'),
      'utf8'
    )
    const newThreadPage = readFileSync(resolve('src/renderer/src/pages/NewThreadPage.vue'), 'utf8')
    const memoryUpdateChip = readFileSync(
      resolve('src/renderer/src/components/chat/MemoryUpdateChip.vue'),
      'utf8'
    )

    expect(styleCss).toContain('var(--window-follower-portal-max-width')
    expect(styleCss).toContain('var(--window-follower-portal-max-height')
    expect(styleCss).toMatch(/max-width:[^;}]+!important/)
    expect(styleCss).toMatch(/max-height:[^;}]+!important/)
    expect(chatStatusBar).toContain('[--window-follower-portal-max-width:38rem]')
    expect(chatStatusBar).toContain('[--window-follower-portal-max-width:20rem]')
    expect(chatStatusBar).toContain('[--window-follower-portal-max-width:20rem] text-xs')
    expect(chatStatusBar).toContain('[--window-follower-portal-max-width:18rem]')
    expect(scrollablePopover).toContain('[--window-follower-portal-max-height:24rem]')
    expect(newThreadPage).toContain(
      '[--window-follower-portal-max-height:min(28rem,calc(var(--reka-dropdown-menu-content-available-height)-0.75rem))]'
    )
    expect(memoryUpdateChip).toContain('[--window-follower-portal-max-width:34rem]')
  })
})
