<template>
  <aside
    v-if="visible && !dismissed"
    data-testid="window-follower-desktop-notice"
    class="window-follower-desktop-notice"
    role="status"
  >
    <Icon icon="lucide:monitor-cog" class="size-4 shrink-0 text-primary" />
    <div class="min-w-0 flex-1">
      <strong>{{ t('chat.windowFollower.settings.permissionsHeading') }}</strong>
      <span>{{ noticeDescription }}</span>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <Button
        v-if="store.state.permissions.accessibility !== 'granted'"
        data-testid="window-follower-desktop-accessibility"
        type="button"
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="openPermission('accessibility')"
      >
        {{ t('chat.windowFollower.settings.accessibility') }}
      </Button>
      <Button
        v-if="store.state.permissions.screenRecording !== 'granted'"
        data-testid="window-follower-desktop-screen-recording"
        type="button"
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="openPermission('screenRecording')"
      >
        {{ t('chat.windowFollower.settings.screenRecording') }}
      </Button>
      <Button
        v-if="permissionsComplete && !store.settings.automaticAdhesion"
        data-testid="window-follower-desktop-enable"
        type="button"
        variant="outline"
        size="sm"
        :disabled="busy"
        @click="enableAutomaticAdhesion"
      >
        {{ t('chat.windowFollower.settings.automaticAdhesion') }}
      </Button>
      <Button
        data-testid="window-follower-desktop-dismiss"
        type="button"
        variant="ghost"
        size="icon"
        :aria-label="t('common.close')"
        @click="dismissed = true"
      >
        <Icon icon="lucide:x" class="size-4" />
      </Button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@shadcn/components/ui/button'
import { useWindowFollowerStore } from '@/stores/windowFollower'

const { t } = useI18n()
const store = useWindowFollowerStore()
const busy = ref(false)
const dismissed = ref(false)

const permissionsComplete = computed(
  () =>
    store.state.permissions.accessibility === 'granted' &&
    store.state.permissions.screenRecording === 'granted'
)
const visible = computed(
  () =>
    store.state.mode === 'normal' &&
    store.state.permissions.platform === 'macos' &&
    (!permissionsComplete.value || !store.settings.automaticAdhesion)
)
const noticeDescription = computed(() =>
  permissionsComplete.value
    ? t('chat.windowFollower.settings.adhesion.paused')
    : t('chat.windowFollower.settings.adhesion.waitingPermissions')
)

const run = async (operation: () => Promise<unknown>) => {
  if (busy.value) return
  busy.value = true
  try {
    await operation()
  } catch {
    return
  } finally {
    busy.value = false
  }
}

const openPermission = (permission: 'accessibility' | 'screenRecording') => {
  void run(() => store.openPermissionSettings(permission))
}

const enableAutomaticAdhesion = () => {
  void run(async () => {
    await store.setAutomaticAdhesion(true)
    await store.loadSettings()
  })
}

onMounted(() => {
  void run(() => store.loadSettings())
})
</script>

<style scoped>
.window-follower-desktop-notice {
  display: flex;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid hsl(var(--border));
  padding: 6px 10px 6px 14px;
  background: hsl(var(--accent) / 0.45);
}

.window-follower-desktop-notice strong,
.window-follower-desktop-notice span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-follower-desktop-notice strong {
  font-size: 12px;
  font-weight: 600;
}

.window-follower-desktop-notice span {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}
</style>
