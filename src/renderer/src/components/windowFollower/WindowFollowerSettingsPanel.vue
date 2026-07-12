<template>
  <section
    class="window-follower-settings"
    :aria-label="t('chat.windowFollower.settings.ariaLabel')"
  >
    <header class="window-follower-settings-header">
      <Button
        data-testid="window-follower-settings-back"
        type="button"
        variant="ghost"
        size="icon"
        class="size-9 shrink-0"
        :aria-label="t('chat.windowFollower.settings.back')"
        @click="emit('close')"
      >
        <Icon icon="lucide:arrow-left" class="size-4" />
      </Button>
      <h1>{{ t('chat.windowFollower.settings.title') }}</h1>
    </header>

    <div class="window-follower-settings-body">
      <section class="settings-section" aria-labelledby="window-follower-behavior-heading">
        <h2 id="window-follower-behavior-heading">
          {{ t('chat.windowFollower.settings.behaviorHeading') }}
        </h2>

        <div class="settings-row">
          <div class="min-w-0">
            <strong>{{ t('chat.windowFollower.settings.automaticAdhesion') }}</strong>
            <span>{{ automaticAdhesionStatus }}</span>
          </div>
          <Switch
            data-testid="window-follower-automatic-adhesion"
            :model-value="store.settings.automaticAdhesion"
            :disabled="busy"
            :aria-label="t('chat.windowFollower.settings.automaticAdhesion')"
            @update:model-value="setAutomaticAdhesion"
          />
        </div>

        <div class="settings-stack">
          <div class="settings-row-heading">
            <strong>{{ t('chat.windowFollower.settings.panelWidth') }}</strong>
            <span>{{ store.state.panelWidth }} px</span>
          </div>
          <Slider
            data-testid="window-follower-width-slider"
            :model-value="[store.state.panelWidth]"
            :min="230"
            :max="720"
            :step="1"
            :disabled="busy"
            :aria-label="t('chat.windowFollower.settings.panelWidth')"
            @update:model-value="setPanelWidth"
          />
        </div>
      </section>

      <section class="settings-section" aria-labelledby="window-follower-permissions-heading">
        <h2 id="window-follower-permissions-heading">
          {{ t('chat.windowFollower.settings.permissionsHeading') }}
        </h2>
        <button
          data-testid="window-follower-permission-accessibility"
          type="button"
          class="settings-action"
          :disabled="busy"
          @click="openPermission('accessibility')"
        >
          <span>
            <strong>{{ t('chat.windowFollower.settings.accessibility') }}</strong>
            <small>{{ permissionLabel(store.state.permissions.accessibility) }}</small>
          </span>
          <Icon icon="lucide:external-link" class="size-4" />
        </button>
        <button
          data-testid="window-follower-permission-screen-recording"
          type="button"
          class="settings-action"
          :disabled="busy"
          @click="openPermission('screenRecording')"
        >
          <span>
            <strong>{{ t('chat.windowFollower.settings.screenRecording') }}</strong>
            <small>{{ permissionLabel(store.state.permissions.screenRecording) }}</small>
          </span>
          <Icon icon="lucide:external-link" class="size-4" />
        </button>
      </section>

      <section class="settings-section" aria-labelledby="window-follower-exclusions-heading">
        <div class="settings-section-heading">
          <h2 id="window-follower-exclusions-heading">
            {{ t('chat.windowFollower.settings.exclusionsHeading') }}
          </h2>
          <Button
            data-testid="window-follower-exclude-current-app"
            type="button"
            variant="outline"
            size="sm"
            :disabled="busy || !store.settings.currentApp"
            @click="excludeCurrentApp"
          >
            <Icon icon="lucide:ban" class="mr-1.5 size-3.5" />
            {{ t('chat.windowFollower.settings.excludeCurrentApp') }}
          </Button>
        </div>

        <div v-if="store.settings.excludedApps.length" class="excluded-list">
          <div v-for="app in store.settings.excludedApps" :key="app.id" class="excluded-item">
            <div class="min-w-0">
              <strong :title="app.name">{{ app.name }}</strong>
              <span :title="app.id">{{ app.id }}</span>
            </div>
            <Button
              :data-testid="`window-follower-restore-${app.id}`"
              type="button"
              variant="ghost"
              size="sm"
              :disabled="busy"
              @click="removeExcludedApp(app.id)"
            >
              {{ t('chat.windowFollower.settings.restore') }}
            </Button>
          </div>
        </div>
        <p v-else class="settings-empty">
          {{ t('chat.windowFollower.settings.noExcludedApps') }}
        </p>
      </section>

      <section class="settings-section" aria-labelledby="window-follower-diagnostics-heading">
        <h2 id="window-follower-diagnostics-heading">
          {{ t('chat.windowFollower.settings.diagnosticsHeading') }}
        </h2>
        <button
          data-testid="window-follower-open-debug"
          type="button"
          class="settings-action"
          @click="openDebug"
        >
          <span>
            <strong>{{ t('chat.windowFollower.settings.debugTitle') }}</strong>
            <small>{{ t('chat.windowFollower.settings.debugDescription') }}</small>
          </span>
          <Icon icon="lucide:bug" class="size-4" />
        </button>
      </section>

      <p v-if="store.commandError" class="settings-error" role="alert">
        {{ t('chat.windowFollower.errors.commandFailed', { message: store.commandError }) }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@shadcn/components/ui/button'
import { Slider } from '@shadcn/components/ui/slider'
import { Switch } from '@shadcn/components/ui/switch'
import type { WindowContextSnapshot } from '@shared/windowFollower'
import { useWindowFollowerStore } from '@/stores/windowFollower'
import { useWindowFollowerDebugStore } from '@/stores/windowFollowerDebug'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const store = useWindowFollowerStore()
const debugStore = useWindowFollowerDebugStore()
const busy = ref(false)
type DesktopPermissionState = WindowContextSnapshot['permissions']['accessibility']

const automaticAdhesionStatus = computed(() => {
  if (!store.settings.automaticAdhesion) {
    return t('chat.windowFollower.settings.adhesion.paused')
  }
  return store.state.automaticAdhesionAvailable
    ? t('chat.windowFollower.settings.adhesion.available')
    : t('chat.windowFollower.settings.adhesion.waitingPermissions')
})

const permissionLabel = (state: DesktopPermissionState) => {
  if (state === 'granted') return t('chat.windowFollower.settings.permission.granted')
  if (state === 'missing') return t('chat.windowFollower.settings.permission.missing')
  if (state === 'not-applicable') {
    return t('chat.windowFollower.settings.permission.notApplicable')
  }
  return t('chat.windowFollower.settings.permission.checking')
}

const run = async (operation: () => Promise<unknown>) => {
  if (busy.value) return
  busy.value = true
  try {
    await operation()
  } catch {
    // The store owns the user-visible command error.
  } finally {
    busy.value = false
  }
}

const setAutomaticAdhesion = (enabled: boolean) => {
  void run(async () => {
    await store.setAutomaticAdhesion(Boolean(enabled))
    await store.loadSettings()
  })
}

const setPanelWidth = (value: number[] | undefined) => {
  const width = value?.[0]
  if (typeof width === 'number') void run(() => store.setWidth(width))
}

const openPermission = (permission: 'accessibility' | 'screenRecording') => {
  void run(() => store.openPermissionSettings(permission))
}

const excludeCurrentApp = () => {
  void run(() => store.excludeCurrentApp())
}

const removeExcludedApp = (id: string) => {
  void run(() => store.removeExcludedApp(id))
}

const openDebug = () => {
  debugStore.open()
  emit('close')
}

onMounted(() => {
  void run(() => store.loadSettings())
})
</script>

<style scoped>
.window-follower-settings {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  background: hsl(var(--background));
}

.window-follower-settings-header {
  -webkit-app-region: drag;
  display: flex;
  height: 40px;
  min-height: 40px;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0 8px 0 2px;
}

.window-follower-settings-header button {
  -webkit-app-region: no-drag;
}

.window-follower-settings-header h1 {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-follower-settings-body {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.settings-section {
  padding: 4px 0 14px;
  border-bottom: 1px solid hsl(var(--border));
}

.settings-section + .settings-section {
  padding-top: 14px;
}

.settings-section h2 {
  margin-bottom: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.settings-row,
.settings-row-heading,
.settings-section-heading,
.excluded-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-row strong,
.settings-action strong,
.excluded-item strong {
  display: block;
  overflow: hidden;
  font-size: 13px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-row span,
.settings-action small,
.excluded-item span,
.settings-row-heading span,
.settings-empty {
  display: block;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: 1.45;
}

.settings-stack {
  margin-top: 16px;
}

.settings-row-heading {
  margin-bottom: 10px;
  font-size: 13px;
}

.settings-section-heading {
  align-items: start;
}

.settings-action {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 4px;
  border: 0;
  border-bottom: 1px solid hsl(var(--border) / 0.7);
  color: hsl(var(--foreground));
  background: transparent;
  text-align: left;
}

.settings-action:hover {
  background: hsl(var(--accent));
}

.settings-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.excluded-list {
  margin-top: 8px;
}

.excluded-item {
  min-height: 44px;
  padding: 6px 0 6px 4px;
  border-bottom: 1px solid hsl(var(--border) / 0.7);
}

.excluded-item > div {
  overflow: hidden;
}

.settings-empty {
  padding: 8px 4px;
}

.settings-error {
  margin-top: 12px;
  overflow-wrap: anywhere;
  color: hsl(var(--destructive));
  font-size: 12px;
}
</style>
