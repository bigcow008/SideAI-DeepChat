<template>
  <div
    data-testid="window-follower-history-overlay"
    class="window-follower-history-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="t('chat.windowFollower.history.title')"
  >
    <button
      data-testid="window-follower-history-backdrop"
      type="button"
      class="window-follower-history-backdrop"
      :aria-label="t('chat.windowFollower.history.close')"
      @click="emit('close')"
    />

    <section data-testid="window-follower-history-panel" class="window-follower-history-panel">
      <header class="window-follower-history-header">
        <Icon icon="lucide:history" class="size-4" />
        <h2>{{ t('chat.windowFollower.history.title') }}</h2>
      </header>

      <div
        data-testid="window-follower-history-list"
        class="window-follower-history-list"
        @scroll.passive="handleScroll"
      >
        <div v-if="sessionStore.loading" class="window-follower-history-state">
          {{ t('chat.windowFollower.history.loading') }}
        </div>

        <template v-else>
          <section v-if="pinnedSessions.length" class="window-follower-history-group">
            <h3>{{ t('chat.windowFollower.history.pinned') }}</h3>
            <button
              v-for="session in pinnedSessions"
              :key="session.id"
              type="button"
              class="window-follower-history-session"
              :class="{
                'window-follower-history-session--active':
                  sessionStore.activeSessionId === session.id
              }"
              :data-session-id="session.id"
              :aria-current="sessionStore.activeSessionId === session.id ? 'page' : undefined"
              @click="selectSession(session.id)"
            >
              <Icon icon="lucide:pin" class="size-3.5 shrink-0" />
              <span>{{ session.title }}</span>
            </button>
          </section>

          <section
            v-for="group in sessionStore.sessionGroups"
            :key="group.id"
            class="window-follower-history-group"
          >
            <h3>{{ group.labelKey ? t(group.labelKey) : group.label }}</h3>
            <button
              v-for="session in group.sessions"
              :key="session.id"
              type="button"
              class="window-follower-history-session"
              :class="{
                'window-follower-history-session--active':
                  sessionStore.activeSessionId === session.id
              }"
              :data-session-id="session.id"
              :aria-current="sessionStore.activeSessionId === session.id ? 'page' : undefined"
              @click="selectSession(session.id)"
            >
              <Icon icon="lucide:message-square" class="size-3.5 shrink-0" />
              <span>{{ session.title }}</span>
            </button>
          </section>

          <div v-if="isEmpty" class="window-follower-history-state">
            <strong>{{ t('chat.windowFollower.history.emptyTitle') }}</strong>
            <span>{{ t('chat.windowFollower.history.emptyDescription') }}</span>
          </div>

          <div v-if="sessionStore.loadingMore" class="window-follower-history-state">
            {{ t('chat.windowFollower.history.loading') }}
          </div>
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@/stores/ui/session'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const sessionStore = useSessionStore()
const pinnedSessions = computed(() => sessionStore.getPinnedSessions(null))
const isEmpty = computed(
  () => pinnedSessions.value.length === 0 && sessionStore.sessionGroups.length === 0
)

const selectSession = async (sessionId: string) => {
  await sessionStore.selectSession(sessionId)
  emit('close')
}

const handleScroll = (event: Event) => {
  const list = event.currentTarget as HTMLElement
  const distanceToBottom = list.scrollHeight - list.scrollTop - list.clientHeight
  if (distanceToBottom <= 96 && sessionStore.hasMore && !sessionStore.loadingMore) {
    void sessionStore.loadNextPage()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.window-follower-history-overlay {
  position: absolute;
  inset: 0;
  z-index: var(--dc-z-sidepanel);
  min-width: 0;
}

.window-follower-history-backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: hsl(var(--background) / 0.68);
  backdrop-filter: blur(var(--dc-blur-soft));
  -webkit-backdrop-filter: blur(var(--dc-blur-soft));
}

.window-follower-history-panel {
  position: absolute;
  inset: 48px 8px 8px;
  display: flex;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--background));
  box-shadow: 0 18px 40px -26px rgb(15 23 42 / 0.72);
}

.window-follower-history-header {
  display: flex;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid hsl(var(--border));
  padding: 0 12px;
}

.window-follower-history-header h2 {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-follower-history-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
}

.window-follower-history-group + .window-follower-history-group {
  margin-top: 12px;
}

.window-follower-history-group h3 {
  margin: 0 4px 4px;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-follower-history-session {
  display: flex;
  width: 100%;
  min-height: 34px;
  align-items: center;
  gap: 8px;
  border-radius: 6px;
  padding: 6px 8px;
  color: hsl(var(--muted-foreground));
  text-align: left;
}

.window-follower-history-session:hover,
.window-follower-history-session--active {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.window-follower-history-session span {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-follower-history-state {
  display: flex;
  min-height: 72px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}

.window-follower-history-state strong {
  color: hsl(var(--foreground));
  font-weight: 600;
}
</style>
