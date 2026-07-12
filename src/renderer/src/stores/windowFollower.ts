import { createWindowFollowerClient } from '@api/WindowFollowerClient'
import type {
  WindowFollowerDebugDto,
  WindowFollowerMode,
  WindowFollowerSettingsDto
} from '@shared/windowFollower'
import { computed, readonly, ref } from 'vue'
import { defineStore } from 'pinia'

const createDefaultState = (): WindowFollowerDebugDto => ({
  mode: 'normal',
  collapsed: false,
  panelWidth: 360,
  automaticAdhesionAvailable: false,
  snapshot: null,
  permissions: {
    platform: 'unknown',
    accessibility: 'unknown',
    screenRecording: 'unknown',
    checkedAt: 0
  },
  panelBounds: null,
  displayBounds: [],
  placement: null,
  contentOffsetX: 0,
  lastError: null,
  updatedAt: 0
})

const createDefaultSettings = (): WindowFollowerSettingsDto => ({
  automaticAdhesion: true,
  currentApp: null,
  excludedApps: []
})

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

export const useWindowFollowerStore = defineStore('windowFollower', () => {
  const client = createWindowFollowerClient()
  const state = ref<WindowFollowerDebugDto>(createDefaultState())
  const settings = ref<WindowFollowerSettingsDto>(createDefaultSettings())
  const initialized = ref(false)
  const initializationError = ref<string | null>(null)
  const commandError = ref<string | null>(null)
  const isPanelMode = computed(() => state.value.mode !== 'normal')
  let unsubscribe: (() => void) | null = null
  let eventRevision = 0
  let initializationPromise: Promise<void> | null = null

  const applyState = (nextState: WindowFollowerDebugDto) => {
    state.value = nextState
  }

  const subscribe = () => {
    if (unsubscribe) return
    unsubscribe = client.onStateChanged((nextState) => {
      eventRevision += 1
      applyState(nextState)
    })
  }

  const initialize = (): Promise<void> => {
    if (initialized.value) return Promise.resolve()
    if (initializationPromise) return initializationPromise

    subscribe()
    const revisionAtRequest = eventRevision
    const pending = client
      .getState()
      .then((nextState) => {
        if (eventRevision === revisionAtRequest) {
          applyState(nextState)
        }
        initializationError.value = null
      })
      .catch((error) => {
        initializationError.value = errorText(error)
      })
      .finally(() => {
        initialized.value = true
        if (initializationPromise === pending) {
          initializationPromise = null
        }
      })

    initializationPromise = pending
    return pending
  }

  const runCommand = async (command: () => Promise<WindowFollowerDebugDto>) => {
    commandError.value = null
    try {
      const nextState = await command()
      applyState(nextState)
      return nextState
    } catch (error) {
      commandError.value = errorText(error)
      throw error
    }
  }

  const runSettingsCommand = async (command: () => Promise<WindowFollowerSettingsDto>) => {
    commandError.value = null
    try {
      const nextSettings = await command()
      settings.value = nextSettings
      return nextSettings
    } catch (error) {
      commandError.value = errorText(error)
      throw error
    }
  }

  const runCombinedCommand = async (
    command: () => Promise<{
      settings: WindowFollowerSettingsDto
      state: WindowFollowerDebugDto
    }>
  ) => {
    commandError.value = null
    try {
      const result = await command()
      settings.value = result.settings
      applyState(result.state)
      return result
    } catch (error) {
      commandError.value = errorText(error)
      throw error
    }
  }

  const runAction = async (command: () => Promise<boolean>) => {
    commandError.value = null
    try {
      return await command()
    } catch (error) {
      commandError.value = errorText(error)
      throw error
    }
  }

  const refresh = () => runCommand(() => client.refresh())
  const setMode = (mode: WindowFollowerMode) => runCommand(() => client.setMode(mode))
  const setCollapsed = (collapsed: boolean) => runCommand(() => client.setCollapsed(collapsed))
  const setWidth = (width: number) => runCommand(() => client.setWidth(width))
  const setPointerInteractive = (interactive: boolean) =>
    runCommand(() => client.setPointerInteractive(interactive))
  const setAutomaticAdhesion = (enabled: boolean) =>
    runCommand(() => client.setAutomaticAdhesion(enabled))
  const openPermissionSettings = (permission: 'accessibility' | 'screenRecording') =>
    runCommand(() => client.openPermissionSettings(permission))
  const resetWidth = () => runCommand(() => client.resetWidth())
  const loadSettings = () => runSettingsCommand(() => client.getSettings())
  const excludeCurrentApp = () => runCombinedCommand(() => client.excludeCurrentApp())
  const removeExcludedApp = (id: string) => runCombinedCommand(() => client.removeExcludedApp(id))
  const hide = () => runAction(() => client.hide())
  const quit = () => runAction(() => client.quit())

  const dispose = () => {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    state: readonly(state),
    settings: readonly(settings),
    initialized: readonly(initialized),
    initializationError: readonly(initializationError),
    commandError: readonly(commandError),
    isPanelMode,
    initialize,
    dispose,
    refresh,
    setMode,
    setCollapsed,
    setWidth,
    setPointerInteractive,
    setAutomaticAdhesion,
    openPermissionSettings,
    resetWidth,
    loadSettings,
    excludeCurrentApp,
    removeExcludedApp,
    hide,
    quit
  }
})
