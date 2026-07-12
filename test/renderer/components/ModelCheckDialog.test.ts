import type { readFileSync as ReadFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const modelStore = reactive({
  allProviderModels: [
    {
      providerId: 'openai',
      models: [{ id: 'gpt-4.1', name: 'GPT-4.1' }]
    }
  ]
})

const providerStore = {
  checkProvider: vi.fn().mockResolvedValue({ isOk: true, errorMsg: null })
}

const readText = async (path: string) => {
  const { readFileSync } = await vi.importActual<{ readFileSync: typeof ReadFileSync }>('node:fs')
  return readFileSync(path, 'utf8')
}

vi.mock('@/stores/modelStore', () => ({
  useModelStore: () => modelStore
}))

vi.mock('@/stores/providerStore', () => ({
  useProviderStore: () => providerStore
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const passthrough = (name: string, tag = 'div') =>
  defineComponent({
    name,
    inheritAttrs: false,
    template: `<${tag} v-bind="$attrs"><slot /></${tag}>`
  })

const mountDialog = async () => {
  const ModelCheckDialog = (await import('@/components/settings/ModelCheckDialog.vue')).default
  return mount(ModelCheckDialog, {
    props: {
      open: true,
      providerId: 'openai'
    },
    global: {
      stubs: {
        Dialog: passthrough('Dialog'),
        DialogContent: passthrough('DialogContent'),
        DialogHeader: passthrough('DialogHeader'),
        DialogTitle: passthrough('DialogTitle'),
        DialogDescription: passthrough('DialogDescription'),
        DialogFooter: passthrough('DialogFooter'),
        Button: passthrough('Button', 'button'),
        Label: passthrough('Label', 'label'),
        Select: passthrough('Select'),
        SelectTrigger: passthrough('SelectTrigger'),
        SelectContent: passthrough('SelectContent'),
        SelectItem: passthrough('SelectItem'),
        SelectValue: passthrough('SelectValue'),
        Icon: true
      }
    }
  })
}

describe('ModelCheckDialog panel layout', () => {
  beforeEach(() => {
    document.documentElement.dataset.windowFollowerSurface = 'panel'
    document.documentElement.style.setProperty('--window-follower-content-offset-x', '44px')
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-window-follower-surface')
    document.documentElement.style.removeProperty('--window-follower-content-offset-x')
  })

  it('bounds the dialog to the real panel viewport and uses a single-column form', async () => {
    const wrapper = await mountDialog()

    expect(wrapper.get('[data-testid="model-check-dialog"]').classes()).toContain(
      'window-follower-viewport-bound'
    )
    expect(wrapper.get('[data-testid="model-check-form"]').classes()).toContain(
      'window-follower-single-column'
    )
  })

  it('constrains every global panel portal outside the transparent reserve', async () => {
    const styleCss = await readText(resolve('src/renderer/src/assets/style.css'))

    for (const slot of [
      'dialog-content',
      'dialog-overlay',
      'alert-dialog-content',
      'alert-dialog-overlay',
      'popover-content',
      'dropdown-menu-content',
      'dropdown-menu-sub-content',
      'select-content',
      'tooltip-content'
    ]) {
      expect(styleCss).toContain(`[data-slot='${slot}']`)
    }
    expect(styleCss).toContain('--window-follower-content-offset-x')
    expect(styleCss).toMatch(/max-width:\s*min\(/)
    expect(styleCss).toMatch(
      /html\[data-window-follower-surface='panel'\]\s+body\s*\{[^}]*clip-path:/s
    )
    const floatingWidthRule = styleCss.match(
      /:where\([\s\S]*?\[data-slot='popover-content'\][\s\S]*?\)\s*\{([^}]*)\}/
    )
    expect(floatingWidthRule?.[1]).toContain('max-width:')
    expect(floatingWidthRule?.[1]).not.toContain('max-height:')
    expect(styleCss).toMatch(/max-width:[^;}]+!important/)
    for (const availableHeight of [
      '--reka-popover-content-available-height',
      '--reka-dropdown-menu-content-available-height',
      '--reka-select-content-available-height',
      '--reka-tooltip-content-available-height'
    ]) {
      expect(styleCss).toContain(`var(${availableHeight}`)
    }
    expect(styleCss).toMatch(/max-height:[^;}]+!important/)
  })

  it('preserves component-specific dialog max widths in wider panels', async () => {
    const styleCss = await readText(resolve('src/renderer/src/assets/style.css'))
    const viewportBoundRule = styleCss.match(
      /html\[data-window-follower-surface='panel'\] \.window-follower-viewport-bound\s*\{([^}]*)\}/s
    )?.[1]
    const dialogRule = styleCss.match(
      /:is\(\[data-slot='dialog-content'\], \[data-slot='alert-dialog-content'\]\)\s*\{([^}]*)\}/s
    )?.[1]

    expect(viewportBoundRule).toContain('width: calc(')
    expect(viewportBoundRule).not.toContain('max-width:')
    expect(viewportBoundRule).not.toContain('max-height:')
    expect(dialogRule).toContain('width: calc(')
    expect(dialogRule).not.toContain('max-width:')
    expect(dialogRule).not.toContain('max-height:')
  })

  it('combines the model select height cap with the available portal height', async () => {
    const wrapper = await mountDialog()
    const selectContent = wrapper.findComponent({ name: 'SelectContent' })

    expect(selectContent.classes()).toContain('max-h-60')
    expect(selectContent.classes()).toContain('[--window-follower-portal-max-height:15rem]')
  })
})
