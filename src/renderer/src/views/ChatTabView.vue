<template>
  <div
    data-testid="chat-tab-layout"
    class="window-follower-chat-layout relative flex h-full min-h-0 w-full flex-row overflow-hidden"
  >
    <WindowFollowerSessionControls
      :history-open="historyOpen"
      :with-chat-actions="pageRouter.currentRoute === 'chat'"
      :with-page-debug="pageRouter.currentRoute !== 'chat'"
      @toggle-history="historyOpen = !historyOpen"
    />
    <Button
      v-if="pageRouter.currentRoute !== 'chat' && !windowFollowerDebugStore.isOpen"
      variant="ghost"
      size="icon"
      class="absolute right-4 top-2.5 z-[var(--dc-z-sticky)] h-7 w-7 text-muted-foreground hover:text-foreground"
      :title="t('settings.deepchatAgents.debug.entry')"
      :aria-label="t('settings.deepchatAgents.debug.entry')"
      @click="windowFollowerDebugStore.open"
    >
      <Icon icon="lucide:bug" class="h-4 w-4" />
    </Button>
    <div
      data-testid="chat-route-region"
      class="window-follower-chat-main relative flex h-full min-h-0 min-w-0 w-0 flex-1 transition-[width] duration-[var(--dc-motion-default)] ease-[var(--dc-ease-out-express)]"
    >
      <template v-if="isReady">
        <!--
          Wrapper is a real DOM root for page components whose root may be a provider/fragment.
          Avoid a full ChatPage route transition here: fading a large scrollable message tree
          forces expensive compositing during conversation switches.
        -->
        <div
          v-if="pageRouter.currentRoute === 'newThread' && agentStore.selectedAgentId === null"
          key="agent-welcome"
          class="chat-route-shell flex h-full min-h-0 w-full flex-col overflow-hidden"
        >
          <AgentWelcomePage />
        </div>
        <div
          v-else-if="pageRouter.currentRoute === 'newThread'"
          key="new-thread"
          class="chat-route-shell flex h-full min-h-0 w-full flex-col overflow-hidden"
        >
          <NewThreadPage />
        </div>
        <div
          v-else-if="pageRouter.currentRoute === 'chat' && pageRouter.chatSessionId"
          :key="pageRouter.chatSessionId"
          class="chat-route-shell flex h-full min-h-0 w-full flex-col overflow-hidden"
        >
          <ChatPage :session-id="pageRouter.chatSessionId" />
        </div>
      </template>
    </div>

    <ChatSidePanel
      class="window-follower-side-panel-overlay"
      :session-id="pageRouter.currentRoute === 'chat' ? pageRouter.chatSessionId : null"
      :workspace-path="sessionStore.activeSession?.projectDir ?? null"
    />
    <WindowFollowerHistoryOverlay
      v-if="historyOpen && windowFollowerStore.state.mode !== 'normal'"
      @close="historyOpen = false"
    />
    <div v-if="windowFollowerDebugStore.isOpen" class="absolute inset-0 z-[var(--dc-z-modal)]">
      <WindowFollowerDebugView @close="windowFollowerDebugStore.close" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@shadcn/components/ui/button'
import { createStartupClient } from '@api/StartupClient'
import ChatSidePanel from '@/components/sidepanel/ChatSidePanel.vue'
import NewThreadPage from '@/pages/NewThreadPage.vue'
import ChatPage from '@/pages/ChatPage.vue'
import AgentWelcomePage from '@/pages/AgentWelcomePage.vue'
import { usePageRouterStore } from '@/stores/ui/pageRouter'
import { useSessionStore } from '@/stores/ui/session'
import { useAgentStore } from '@/stores/ui/agent'
import { useProjectStore } from '@/stores/ui/project'
import { useModelStore } from '@/stores/modelStore'
import { useOllamaStore } from '@/stores/ollamaStore'
import { useStartupWorkloadStore } from '@/stores/startupWorkloadStore'
import { markStartupInteractive, scheduleStartupDeferredTask } from '@/lib/startupDeferred'
import WindowFollowerDebugView from '@/components/windowFollower/WindowFollowerDebugView.vue'
import WindowFollowerHistoryOverlay from '@/components/windowFollower/WindowFollowerHistoryOverlay.vue'
import WindowFollowerSessionControls from '@/components/windowFollower/WindowFollowerSessionControls.vue'
import { useWindowFollowerDebugStore } from '@/stores/windowFollowerDebug'
import { useWindowFollowerStore } from '@/stores/windowFollower'

const pageRouter = usePageRouterStore()
const { t } = useI18n()
const sessionStore = useSessionStore()
const agentStore = useAgentStore()
const projectStore = useProjectStore()
const modelStore = useModelStore()
const ollamaStore = useOllamaStore()
const windowFollowerDebugStore = useWindowFollowerDebugStore()
const windowFollowerStore = useWindowFollowerStore()
const historyOpen = ref(false)
let startupWorkloadStore: ReturnType<typeof useStartupWorkloadStore> | null = null

watch(
  () => windowFollowerStore.state.mode,
  (mode) => {
    if (mode === 'normal') historyOpen.value = false
  }
)

try {
  startupWorkloadStore = useStartupWorkloadStore()
} catch (error) {
  console.warn('[Startup][Renderer] startupWorkloadStore unavailable in ChatTabView', error)
}
const isReady = ref(false)
let cancelDeferredHydration: (() => void) | null = null

const initializeRouteFromFallbackState = async () => {
  if (sessionStore.error) {
    await pageRouter.initialize()
    return
  }

  await pageRouter.initialize({
    activeSessionId: sessionStore.activeSessionId ?? null
  })
}

onMounted(async () => {
  startupWorkloadStore?.connect()
  console.info('[Startup][Renderer] ChatTabView critical hydration begin')
  let criticalLoadPromises: Promise<void> | null = null

  try {
    const startupClient = createStartupClient()
    const bootstrap = await startupClient.getBootstrap()
    console.info(
      `[Startup][Renderer] startup.bootstrap.ready run=${bootstrap.startupRunId} agents=${bootstrap.agents.length} activeSession=${bootstrap.activeSessionId ?? 'none'}`
    )

    await sessionStore.applyBootstrapShell({
      activeSessionId: bootstrap.activeSessionId,
      activeSession: bootstrap.activeSession ?? null
    })
    agentStore.applyBootstrapAgents(bootstrap.agents)
    projectStore.applyBootstrapDefaultProjectPath(
      bootstrap.defaultProjectPath,
      bootstrap.defaultChatWorkspacePath ?? null
    )

    await pageRouter.initialize({
      activeSessionId: bootstrap.activeSessionId
    })

    // Start loading agents, projects, models, and ollama immediately after router init
    // Don't block on them, they load in background while we mark interactive
    criticalLoadPromises = Promise.allSettled([
      agentStore.fetchAgents(),
      projectStore.fetchProjects(),
      modelStore.initialize(),
      ollamaStore.initialize()
    ]).then(() => {
      console.info('[Startup][Renderer] ChatTabView critical loads complete')
    })
  } catch (error) {
    console.warn('[Startup][Renderer] ChatTabView critical hydration failed:', error)
    await Promise.allSettled([agentStore.fetchAgents(), projectStore.loadDefaultProjectPath()])
    await initializeRouteFromFallbackState()
  } finally {
    isReady.value = true
    console.info('[Startup][Renderer] ChatTabView interactive ready')

    // Session data is already loading in parallel from App.vue.onMounted
    // Don't block on it here - let it load in background
    if (!sessionStore.hasLoadedInitialPage) {
      void sessionStore.fetchSessions()
    }

    markStartupInteractive()
    cancelDeferredHydration = scheduleStartupDeferredTask(async () => {
      console.info('[Startup][Renderer] ChatTabView deferred hydration begin')
      // Wait for critical loads if they're still running
      if (criticalLoadPromises) {
        await criticalLoadPromises
      }
      console.info('[Startup][Renderer] ChatTabView deferred hydration complete')
    })
  }
})

onBeforeUnmount(() => {
  if (cancelDeferredHydration) {
    cancelDeferredHydration()
    cancelDeferredHydration = null
  }
})
</script>

<style scoped>
/*
 * TooltipProvider renders no DOM node, so the page's real root is the shell's
 * direct child. Stretch that child without forcing display (NewThread needs flex).
 */
.chat-route-shell > :deep(*) {
  height: 100%;
  min-height: 0;
  min-width: 0;
  flex: 1 1 0%;
}

:global(html[data-window-follower-surface='panel']) .window-follower-chat-layout {
  isolation: isolate;
}

:global(html[data-window-follower-surface='panel']) .window-follower-chat-main {
  width: 100%;
}
</style>
