<template>
  <div data-testid="window-follower-viewport" class="window-follower-viewport">
    <div
      v-show="!isPanelMode || !collapsed"
      data-testid="window-follower-surface"
      class="window-follower-surface"
      :data-window-follower-surface="isPanelMode ? 'panel' : 'desktop'"
      :style="surfaceStyle"
    >
      <slot />
    </div>
    <div
      v-if="isPanelMode && collapsed"
      class="window-follower-collapsed-layer"
      :style="contentStyle"
    >
      <slot name="collapsed" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WindowFollowerMode } from '@shared/windowFollower'
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { provideWindowFollowerPortalBounds } from '@shadcn/lib/windowFollowerPortalBounds'

const props = defineProps<{
  mode: WindowFollowerMode
  collapsed: boolean
  contentOffsetX: number
}>()

const emit = defineEmits<{
  'pointer-interactive': [interactive: boolean]
}>()

const isPanelMode = computed(() => props.mode !== 'normal')
const portalContentOffsetX = computed(() => (isPanelMode.value ? props.contentOffsetX : 0))
provideWindowFollowerPortalBounds({
  isPanelMode,
  contentOffsetX: portalContentOffsetX
})

const contentStyle = computed(() => ({
  width: isPanelMode.value ? `calc(100vw - ${props.contentOffsetX}px)` : '100vw',
  transform: `translateX(${isPanelMode.value ? props.contentOffsetX : 0}px)`
}))
const surfaceStyle = contentStyle

let lastPointerClientX: number | null = null
let lastPointerInteractive: boolean | null = null

const publishPointerInteractive = (interactive: boolean) => {
  if (lastPointerInteractive === interactive) return
  lastPointerInteractive = interactive
  emit('pointer-interactive', interactive)
}

const updatePointerInteractive = (clientX: number | null) => {
  publishPointerInteractive(
    isPanelMode.value &&
      props.contentOffsetX > 0 &&
      clientX !== null &&
      clientX >= props.contentOffsetX
  )
}

const handleMouseMove = (event: MouseEvent) => {
  lastPointerClientX = event.clientX
  updatePointerInteractive(event.clientX)
}

const handlePointerLeave = () => {
  lastPointerClientX = null
  updatePointerInteractive(null)
}

watch(
  () => [props.mode, props.contentOffsetX] as const,
  () => updatePointerInteractive(lastPointerClientX)
)

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseleave', handlePointerLeave)
  window.addEventListener('blur', handlePointerLeave)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseleave', handlePointerLeave)
  window.removeEventListener('blur', handlePointerLeave)
  publishPointerInteractive(false)
})
</script>

<style scoped>
.window-follower-viewport {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: transparent;
}

.window-follower-surface {
  height: 100vh;
  overflow: hidden;
  background: var(--background);
}

.window-follower-collapsed-layer {
  position: absolute;
  inset: 0;
}
</style>
