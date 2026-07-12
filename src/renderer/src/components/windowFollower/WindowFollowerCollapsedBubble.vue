<template>
  <div data-testid="window-follower-bubble" class="window-follower-bubble">
    <button
      data-testid="window-follower-bubble-expand"
      type="button"
      class="window-follower-bubble-expand"
      :aria-label="t('chat.windowFollower.bubble.expand')"
      :title="t('chat.windowFollower.bubble.expand')"
      @click="expand"
    >
      <span class="window-follower-bubble-core" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useWindowFollowerStore } from '@/stores/windowFollower'

const { t } = useI18n()
const store = useWindowFollowerStore()
const expand = () => {
  void store.setCollapsed(false).catch(() => {})
}
</script>

<style scoped>
.window-follower-bubble {
  -webkit-app-region: drag;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  overflow: hidden;
  background: transparent;
  cursor: move;
}

.window-follower-bubble-expand {
  -webkit-app-region: no-drag;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.window-follower-bubble-core {
  width: 9px;
  height: 9px;
  border: 1px solid hsl(var(--border));
  border-radius: 50%;
  background: hsl(var(--primary));
  box-shadow:
    0 0 0 3px hsl(var(--background) / 0.88),
    0 1px 5px hsl(var(--foreground) / 0.2);
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;
}

.window-follower-bubble-expand:hover .window-follower-bubble-core,
.window-follower-bubble-expand:focus-visible .window-follower-bubble-core {
  transform: scale(1.12);
  box-shadow:
    0 0 0 4px hsl(var(--background) / 0.92),
    0 2px 7px hsl(var(--foreground) / 0.26);
}

.window-follower-bubble-expand:focus-visible {
  outline: 1px solid hsl(var(--ring));
  outline-offset: 1px;
}
</style>
