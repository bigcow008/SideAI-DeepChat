<template>
  <div
    data-testid="window-follower-resize-handle"
    class="window-follower-resize-handle"
    role="separator"
    aria-orientation="vertical"
    aria-label="调整贴边面板宽度"
    title="拖动调整宽度"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="finishResize"
    @pointercancel="finishResize"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { useWindowFollowerStore } from '@/stores/windowFollower'

type ResizeState = {
  startX: number
  startWidth: number
  pointerId: number
}

const store = useWindowFollowerStore()
let resizeState: ResizeState | null = null
let pendingWidth: number | null = null
let resizeFrame: number | null = null

const flushWidth = () => {
  resizeFrame = null
  const width = pendingWidth
  pendingWidth = null
  if (width === null) return
  void store.setWidth(width).catch(() => {})
}

const queueWidth = (width: number) => {
  pendingWidth = Math.round(width)
  if (resizeFrame === null) resizeFrame = window.requestAnimationFrame(flushWidth)
}

const handlePointerDown = (event: PointerEvent) => {
  const handle = event.currentTarget as HTMLElement
  const surface = handle.closest<HTMLElement>('[data-window-follower-surface]')
  const startWidth = surface?.getBoundingClientRect().width ?? window.innerWidth

  resizeState = {
    startX: event.clientX,
    startWidth: Math.max(0, startWidth),
    pointerId: event.pointerId
  }
  handle.setPointerCapture?.(event.pointerId)
  event.preventDefault()
}

const handlePointerMove = (event: PointerEvent) => {
  if (!resizeState || resizeState.pointerId !== event.pointerId) return
  queueWidth(resizeState.startWidth + event.clientX - resizeState.startX)
  event.preventDefault()
}

const finishResize = (event: PointerEvent) => {
  if (!resizeState || resizeState.pointerId !== event.pointerId) return
  queueWidth(resizeState.startWidth + event.clientX - resizeState.startX)

  if (resizeFrame !== null) {
    window.cancelAnimationFrame(resizeFrame)
    resizeFrame = null
  }
  flushWidth()

  const handle = event.currentTarget as HTMLElement
  if (handle.hasPointerCapture?.(event.pointerId)) handle.releasePointerCapture(event.pointerId)
  resizeState = null
  event.preventDefault()
}

onBeforeUnmount(() => {
  if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame)
})
</script>

<style scoped>
.window-follower-resize-handle {
  -webkit-app-region: no-drag;
  position: absolute;
  top: 40px;
  right: 0;
  bottom: 0;
  z-index: 20;
  width: 8px;
  cursor: ew-resize;
  touch-action: none;
}

.window-follower-resize-handle::after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: hsl(var(--primary) / 0.55);
  content: '';
  opacity: 0;
  transition: opacity 120ms ease;
}

.window-follower-resize-handle:hover::after,
.window-follower-resize-handle:active::after {
  opacity: 1;
}
</style>
