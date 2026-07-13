<template>
  <TooltipProvider
    v-if="windowFollowerStore.state.mode !== 'normal'"
    :delay-duration="200"
    :ignore-non-keyboard-focus="true"
  >
    <div
      data-testid="window-follower-session-controls"
      class="window-follower-session-controls"
      :class="{
        'window-follower-session-controls--with-chat-actions': withChatActions,
        'window-follower-session-controls--with-page-debug': withPageDebug
      }"
    >
      <Tooltip v-if="showNewChat">
        <TooltipTrigger as-child>
          <Button
            data-testid="window-follower-new-chat"
            type="button"
            variant="ghost"
            size="icon"
            class="window-follower-session-button"
            :aria-label="t('chat.windowFollower.session.newChat')"
            @click="newChat"
          >
            <Icon icon="lucide:square-pen" class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('chat.windowFollower.session.newChat') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            data-testid="window-follower-history"
            type="button"
            variant="ghost"
            size="icon"
            class="window-follower-session-button"
            :aria-label="t('chat.windowFollower.history.title')"
            :aria-pressed="historyOpen"
            @click="emit('toggle-history')"
          >
            <Icon icon="lucide:history" class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('chat.windowFollower.history.title') }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            data-testid="window-follower-restore-window"
            type="button"
            variant="ghost"
            size="icon"
            class="window-follower-session-button"
            :aria-label="t('chat.windowFollower.session.restoreWindow')"
            @click="restoreWindow"
          >
            <Icon icon="lucide:panel-top-open" class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ t('chat.windowFollower.session.restoreWindow') }}</TooltipContent>
      </Tooltip>
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@shadcn/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@shadcn/components/ui/tooltip'
import { useSessionStore } from '@/stores/ui/session'
import { useWindowFollowerStore } from '@/stores/windowFollower'

withDefaults(
  defineProps<{
    historyOpen?: boolean
    withChatActions?: boolean
    withPageDebug?: boolean
  }>(),
  {
    historyOpen: false,
    withChatActions: false,
    withPageDebug: false
  }
)

const emit = defineEmits<{ 'toggle-history': [] }>()
const { t } = useI18n()
const sessionStore = useSessionStore()
const windowFollowerStore = useWindowFollowerStore()
const showNewChat = computed(() => sessionStore.hasActiveSession)

const newChat = () => {
  void sessionStore.startNewConversation({ refresh: true })
}

const restoreWindow = () => {
  void windowFollowerStore.setMode('normal').catch(() => {})
}
</script>

<style scoped>
.window-follower-session-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: var(--dc-z-popover);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid hsl(var(--border) / 0.72);
  border-radius: 8px;
  background: hsl(var(--background) / 0.9);
  box-shadow: 0 8px 22px -18px rgb(15 23 42 / 0.65);
  backdrop-filter: blur(var(--dc-blur-soft));
  -webkit-backdrop-filter: blur(var(--dc-blur-soft));
}

.window-follower-session-controls--with-chat-actions {
  right: 112px;
}

.window-follower-session-controls--with-page-debug {
  right: 52px;
}

.window-follower-session-button {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: hsl(var(--muted-foreground));
}

.window-follower-session-button:hover,
.window-follower-session-button[aria-pressed='true'] {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}
</style>
