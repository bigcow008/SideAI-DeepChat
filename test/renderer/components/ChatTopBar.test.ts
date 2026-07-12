import { defineComponent, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const passthrough = (name: string) =>
  defineComponent({
    name,
    template: '<div><slot /></div>'
  })

const ButtonStub = defineComponent({
  name: 'Button',
  inheritAttrs: false,
  emits: ['click'],
  template:
    '<button v-bind="$attrs" type="button" @click="$emit(\'click\', $event)"><slot /></button>'
})

const setup = async () => {
  vi.resetModules()

  const sessionStore = reactive({
    sessions: [
      {
        id: 'session-1',
        title: 'Session Title',
        agentId: 'deepchat',
        status: 'none',
        sessionKind: 'regular',
        isPinned: false
      }
    ],
    newConversationTargetAgentId: null,
    startNewConversation: vi.fn(),
    renameSession: vi.fn(),
    toggleSessionPinned: vi.fn(),
    clearSessionMessages: vi.fn(),
    deleteSession: vi.fn(),
    moveSessionToAgent: vi.fn(),
    exportSession: vi.fn(),
    selectSession: vi.fn()
  })
  const sidepanelStore = reactive({ toggleWorkspace: vi.fn() })

  vi.doMock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key })
  }))
  vi.doMock('@/stores/ui/session', () => ({ useSessionStore: () => sessionStore }))
  vi.doMock('@/stores/ui/agent', () => ({
    useAgentStore: () => reactive({ agents: [], enabledAgents: [], fetchAgents: vi.fn() })
  }))
  vi.doMock('@/stores/ui/sidepanel', () => ({ useSidepanelStore: () => sidepanelStore }))
  vi.doMock('@/stores/ui/sidebar', () => ({
    useSidebarStore: () => reactive({ collapsed: false })
  }))
  vi.doMock('@/stores/windowFollowerDebug', () => ({
    useWindowFollowerDebugStore: () => ({ open: vi.fn() })
  }))
  vi.doMock('@/components/use-toast', () => ({
    useToast: () => ({ toast: vi.fn() })
  }))
  vi.doMock('@/components/agent/AgentTransferDialog.vue', () => ({
    default: passthrough('AgentTransferDialog')
  }))

  const ChatTopBar = (await import('@/components/chat/ChatTopBar.vue')).default
  const wrapper = mount(ChatTopBar, {
    props: {
      sessionId: 'session-1',
      title: 'Session Title',
      project: '/workspace/SideAI'
    },
    global: {
      stubs: {
        AgentTransferDialog: passthrough('AgentTransferDialog'),
        Button: ButtonStub,
        Dialog: passthrough('Dialog'),
        DialogContent: passthrough('DialogContent'),
        DialogDescription: passthrough('DialogDescription'),
        DialogFooter: passthrough('DialogFooter'),
        DialogHeader: passthrough('DialogHeader'),
        DialogTitle: passthrough('DialogTitle'),
        DropdownMenu: passthrough('DropdownMenu'),
        DropdownMenuContent: passthrough('DropdownMenuContent'),
        DropdownMenuItem: passthrough('DropdownMenuItem'),
        DropdownMenuSeparator: passthrough('DropdownMenuSeparator'),
        DropdownMenuTrigger: passthrough('DropdownMenuTrigger'),
        Icon: true
      }
    }
  })

  return { wrapper, sidepanelStore }
}

describe('ChatTopBar', () => {
  it('hides only session copy in compact mode while keeping workspace, share and more controls', async () => {
    const { wrapper } = await setup()

    expect(wrapper.get('[data-testid="chat-topbar"]').classes()).toContain(
      'window-follower-compact'
    )
    expect(wrapper.get('[data-testid="chat-topbar-project-copy"]').classes()).toContain(
      'window-follower-topbar-copy'
    )
    expect(wrapper.get('[data-testid="chat-topbar-title-copy"]').classes()).toContain(
      'window-follower-topbar-copy'
    )
    expect(wrapper.get('[data-testid="chat-topbar-workspace-button"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="chat-topbar-share-button"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="chat-topbar-more-button"]')).toBeTruthy()
  })
})
