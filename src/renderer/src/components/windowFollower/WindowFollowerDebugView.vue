<template>
  <section class="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
    <header class="window-drag-region flex h-12 shrink-0 items-center border-b px-4">
      <Button
        data-testid="window-follower-close"
        variant="ghost"
        size="icon"
        class="no-drag h-7 w-7"
        :title="t('common.back')"
        @click="emit('close')"
      >
        <Icon icon="lucide:arrow-left" class="h-4 w-4" />
      </Button>
      <div class="ml-2 min-w-0 flex-1">
        <h1 class="truncate text-sm font-medium">WindowFollower</h1>
        <p class="truncate text-[11px] text-muted-foreground">
          {{ t('settings.deepchatAgents.debug.entry') }}
        </p>
      </div>
      <div class="no-drag flex items-center gap-1">
        <Button
          data-testid="window-follower-refresh"
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :title="t('mcp.refresh')"
          @click="refresh"
        >
          <Icon icon="lucide:refresh-cw" class="h-4 w-4" :class="{ 'animate-spin': loading }" />
        </Button>
        <Button
          data-testid="window-follower-copy"
          variant="ghost"
          size="icon"
          class="h-7 w-7"
          :title="t('common.copy')"
          @click="copyState"
        >
          <Icon icon="lucide:copy" class="h-4 w-4" />
        </Button>
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div class="mx-auto grid w-full max-w-4xl gap-5 lg:grid-cols-2">
        <section v-for="group in groups" :key="group.name" class="min-w-0">
          <h2 class="mb-2 text-xs font-medium text-muted-foreground">{{ group.name }}</h2>
          <dl class="diagnostic-list">
            <div v-for="item in group.items" :key="item.label">
              <dt>{{ item.label }}</dt>
              <dd :data-testid="item.label === 'mode' ? 'window-follower-mode' : undefined">
                {{ item.value }}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div class="mx-auto mt-4 flex max-w-4xl flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs"
          @click="openPermission('accessibility')"
          >accessibility</Button
        >
        <Button
          variant="outline"
          size="sm"
          class="h-7 text-xs"
          @click="openPermission('screenRecording')"
          >screenRecording</Button
        >
      </div>
      <div
        v-if="debugState?.lastError"
        class="mx-auto mt-5 max-w-4xl border-l-2 border-destructive px-3 py-2 text-xs text-destructive"
      >
        {{ debugState.lastError }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@shadcn/components/ui/button'
import { createWindowFollowerClient } from '@api/WindowFollowerClient'
import type { Bounds, WindowFollowerDebugDto } from '@shared/windowFollower'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const client = createWindowFollowerClient()
const debugState = ref<WindowFollowerDebugDto | null>(null)
const loading = ref(false)
let unsubscribe: (() => void) | null = null

const formatBounds = (bounds?: Bounds | null) =>
  bounds ? `${bounds.x}, ${bounds.y}  ${bounds.width}x${bounds.height}` : '-'
const formatTime = (value?: number | null) => (value ? new Date(value).toLocaleTimeString() : '-')
const groups = computed(() => [
  {
    name: 'tracking',
    items: [
      { label: 'mode', value: debugState.value?.mode ?? '-' },
      { label: 'freshness', value: debugState.value?.snapshot?.freshness ?? 'unavailable' },
      { label: 'source', value: debugState.value?.snapshot?.source ?? 'none' },
      { label: 'placement', value: debugState.value?.placement ?? '-' },
      { label: 'updatedAt', value: formatTime(debugState.value?.updatedAt) }
    ]
  },
  {
    name: 'target',
    items: [
      { label: 'app', value: debugState.value?.snapshot?.app.name ?? '-' },
      { label: 'stableKey', value: debugState.value?.snapshot?.app.stableKey ?? '-' },
      { label: 'processId', value: String(debugState.value?.snapshot?.app.processId ?? '-') },
      { label: 'windowId', value: String(debugState.value?.snapshot?.window.windowId ?? '-') },
      { label: 'title', value: debugState.value?.snapshot?.window.title ?? '-' },
      { label: 'bounds', value: formatBounds(debugState.value?.snapshot?.window.bounds) }
    ]
  },
  {
    name: 'permissions',
    items: [
      { label: 'platform', value: debugState.value?.permissions.platform ?? '-' },
      { label: 'accessibility', value: debugState.value?.permissions.accessibility ?? '-' },
      { label: 'screenRecording', value: debugState.value?.permissions.screenRecording ?? '-' },
      { label: 'checkedAt', value: formatTime(debugState.value?.permissions.checkedAt) }
    ]
  },
  {
    name: 'geometry',
    items: [
      { label: 'panelBounds', value: formatBounds(debugState.value?.panelBounds) },
      {
        label: 'displayBounds',
        value: debugState.value?.displayBounds.map(formatBounds).join(' | ') || '-'
      },
      { label: 'contentOffsetX', value: String(debugState.value?.contentOffsetX ?? 0) },
      { label: 'capturedAt', value: formatTime(debugState.value?.snapshot?.capturedAt) },
      { label: 'lastVerifiedAt', value: formatTime(debugState.value?.snapshot?.lastVerifiedAt) }
    ]
  }
])

const refresh = async () => {
  loading.value = true
  try {
    debugState.value = (await client.refresh()) as WindowFollowerDebugDto
  } finally {
    loading.value = false
  }
}
const copyState = async () => {
  if (debugState.value)
    await navigator.clipboard.writeText(JSON.stringify(debugState.value, null, 2))
}
const openPermission = async (permission: 'accessibility' | 'screenRecording') => {
  debugState.value = (await client.openPermissionSettings(permission)) as WindowFollowerDebugDto
}

onMounted(async () => {
  debugState.value = (await client.getState()) as WindowFollowerDebugDto
  unsubscribe = client.onStateChanged((state) => {
    debugState.value = state
  })
})
onBeforeUnmount(() => unsubscribe?.())
</script>

<style scoped>
.diagnostic-list {
  border-top: 1px solid hsl(var(--border));
}
.diagnostic-list > div {
  display: grid;
  grid-template-columns: minmax(7.5rem, 0.42fr) minmax(0, 1fr);
  gap: 0.75rem;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0.45rem 0;
  font-size: 0.75rem;
}
.diagnostic-list dt {
  color: hsl(var(--muted-foreground));
  font-family: var(--font-mono);
}
.diagnostic-list dd {
  min-width: 0;
  overflow-wrap: anywhere;
  font-family: var(--font-mono);
}
</style>
