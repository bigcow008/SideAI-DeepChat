import { removeExcludedApp, upsertExcludedApp, type ExcludedApp } from './adhesionExclusions'

type OwnerLike =
  | {
      name?: string
      bundleId?: string
      path?: string
    }
  | undefined
  | null

type ExclusionFlowOptions = {
  getExcludedApps: () => ExcludedApp[]
  setExcludedApps: (excludedApps: ExcludedApp[]) => void
  persistExcludedApps: (excludedApps: ExcludedApp[]) => Promise<void>
  updatePanelPosition: () => Promise<void>
}

type ExcludeCurrentAppOptions = ExclusionFlowOptions & { owner: OwnerLike }
type RemoveExcludedAppOptions = ExclusionFlowOptions & { id: string }

async function runOperationThenUpdate(
  operation: () => Promise<void>,
  updatePanelPosition: () => Promise<void>
) {
  let operationError: unknown

  try {
    await operation()
  } catch (error) {
    operationError = error
  }

  try {
    await updatePanelPosition()
  } catch (error) {
    if (!operationError) throw error
  }

  if (operationError) throw operationError
}

export async function excludeCurrentAppWithUpdate(options: ExcludeCurrentAppOptions) {
  await runOperationThenUpdate(async () => {
    const result = upsertExcludedApp(options.getExcludedApps(), options.owner)
    if (result.changed) {
      await options.persistExcludedApps(result.excludedApps)
      options.setExcludedApps(result.excludedApps)
    }
  }, options.updatePanelPosition)
}

export async function removeExcludedAppWithUpdate(options: RemoveExcludedAppOptions) {
  await runOperationThenUpdate(async () => {
    const currentExcludedApps = options.getExcludedApps()
    const nextExcludedApps = removeExcludedApp(currentExcludedApps, options.id)
    if (nextExcludedApps.length === currentExcludedApps.length) return
    await options.persistExcludedApps(nextExcludedApps)
    options.setExcludedApps(nextExcludedApps)
  }, options.updatePanelPosition)
}
