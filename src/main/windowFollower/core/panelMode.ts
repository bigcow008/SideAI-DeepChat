export type PanelMode = {
  locked: boolean
  detached: boolean
  automaticAdhesionAvailable: boolean
}

export function toggleDetachedMode(mode: PanelMode): PanelMode {
  if (mode.detached) return { ...mode, detached: false }
  return { ...mode, locked: false, detached: true }
}

export function toggleLockedMode(mode: PanelMode): PanelMode {
  return { ...mode, locked: !mode.locked, detached: false }
}

export function shouldFollowTarget(mode: PanelMode) {
  return mode.automaticAdhesionAvailable && !mode.locked && !mode.detached
}

export function shouldKeepPanelAlwaysOnTop(mode: PanelMode) {
  return mode.locked || (mode.automaticAdhesionAvailable && !mode.detached)
}

export function shouldPositionPermissionFallback(
  mode: Pick<PanelMode, 'locked' | 'detached'>,
  canReadWindowContext: boolean
) {
  return !canReadWindowContext && !mode.locked && !mode.detached
}

export function shouldClearLockedModeAfterExplicitExclusion({
  lockedAtRequest,
  modeRevisionAtRequest,
  currentModeRevision
}: {
  lockedAtRequest: boolean
  modeRevisionAtRequest: number
  currentModeRevision: number
}) {
  return lockedAtRequest && modeRevisionAtRequest === currentModeRevision
}
