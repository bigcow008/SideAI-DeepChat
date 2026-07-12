<template>
  <TooltipProvider :delay-duration="200" :ignore-non-keyboard-focus="true">
    <nav class="window-follower-toolbar" aria-label="贴边面板操作">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            data-testid="window-follower-toolbar-toggle"
            type="button"
            variant="ghost"
            size="icon"
            class="window-follower-toolbar-button"
            :aria-expanded="groupExpanded"
            aria-label="展开或收起工具栏"
            @click="groupExpanded = !groupExpanded"
          >
            <Icon
              :icon="groupExpanded ? 'lucide:chevrons-left' : 'lucide:chevrons-right'"
              class="size-4"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ groupExpanded ? '收起工具栏' : '展开工具栏' }}</TooltipContent>
      </Tooltip>

      <template v-if="groupExpanded">
        <Tooltip v-for="command in commands" :key="command.id">
          <TooltipTrigger as-child>
            <Button
              :data-testid="
                command.id === 'collapse' ? 'window-follower-collapse-panel' : undefined
              "
              :data-window-follower-command="command.id"
              type="button"
              variant="ghost"
              size="icon"
              class="window-follower-toolbar-button"
              :class="{
                'window-follower-toolbar-button-active': command.active,
                'window-follower-toolbar-button-danger': command.id === 'quit'
              }"
              :aria-label="command.label"
              :aria-pressed="command.active || undefined"
              @click="runCommand(command.id)"
            >
              <Icon :icon="command.icon" class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ command.label }}</TooltipContent>
        </Tooltip>
      </template>

      <div
        data-testid="window-follower-toolbar-drag"
        class="window-follower-toolbar-drag"
        aria-hidden="true"
      />
    </nav>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { Button } from '@shadcn/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@shadcn/components/ui/tooltip'
import { useWindowFollowerStore } from '@/stores/windowFollower'

type ToolbarCommand = 'collapse' | 'pin' | 'detach' | 'reset-width' | 'settings' | 'hide' | 'quit'

const emit = defineEmits<{ 'open-settings': [] }>()
const store = useWindowFollowerStore()
const groupExpanded = ref(false)

const commands = computed(() => [
  {
    id: 'collapse' as const,
    icon: 'lucide:panel-right-close',
    label: '折叠为气泡',
    active: false
  },
  {
    id: 'pin' as const,
    icon: store.state.mode === 'fixed' ? 'lucide:pin-off' : 'lucide:pin',
    label: store.state.mode === 'fixed' ? '取消固定' : '固定',
    active: store.state.mode === 'fixed'
  },
  {
    id: 'detach' as const,
    icon: store.state.mode === 'detached' ? 'lucide:magnet' : 'lucide:unlink',
    label: store.state.mode === 'detached' ? '恢复吸附' : '脱吸附',
    active: store.state.mode === 'detached'
  },
  {
    id: 'reset-width' as const,
    icon: 'lucide:panel-right-dashed',
    label: '恢复默认宽度',
    active: false
  },
  {
    id: 'settings' as const,
    icon: 'lucide:ellipsis',
    label: '设置',
    active: false
  },
  {
    id: 'hide' as const,
    icon: 'lucide:eye-off',
    label: '隐藏',
    active: false
  },
  {
    id: 'quit' as const,
    icon: 'lucide:power',
    label: '退出',
    active: false
  }
])

const ignoreFailure = (operation: Promise<unknown>) => {
  void operation.catch(() => {})
}

const runCommand = (command: ToolbarCommand) => {
  groupExpanded.value = false

  if (command === 'collapse') {
    ignoreFailure(store.setCollapsed(true))
  } else if (command === 'pin') {
    ignoreFailure(store.setMode(store.state.mode === 'fixed' ? 'following' : 'fixed'))
  } else if (command === 'detach') {
    ignoreFailure(store.setMode(store.state.mode === 'detached' ? 'following' : 'detached'))
  } else if (command === 'reset-width') {
    ignoreFailure(store.resetWidth())
  } else if (command === 'settings') {
    emit('open-settings')
  } else if (command === 'hide') {
    ignoreFailure(store.hide())
  } else {
    ignoreFailure(store.quit())
  }
}
</script>

<style scoped>
.window-follower-toolbar {
  -webkit-app-region: drag;
  display: flex;
  width: 100%;
  height: 40px;
  min-height: 40px;
  align-items: center;
  overflow: hidden;
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background) / 0.96);
}

.window-follower-toolbar-button {
  -webkit-app-region: no-drag;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: 0;
  color: hsl(var(--muted-foreground));
}

.window-follower-toolbar-button:hover {
  color: hsl(var(--foreground));
  background: hsl(var(--accent));
}

.window-follower-toolbar-button-active {
  color: hsl(var(--primary));
  background: hsl(var(--accent));
  box-shadow: inset 0 -2px 0 hsl(var(--primary));
}

.window-follower-toolbar-button-danger:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.1);
}

.window-follower-toolbar-drag {
  min-width: 12px;
  height: 100%;
  flex: 1 1 auto;
}
</style>
