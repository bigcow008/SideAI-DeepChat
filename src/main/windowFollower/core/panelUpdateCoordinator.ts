export type PanelUpdateCoordinator = {
  update: () => Promise<void>
  updateFresh: () => Promise<void>
}

export function createPanelUpdateCoordinator(
  runUpdate: () => Promise<void>
): PanelUpdateCoordinator {
  let activeUpdate: Promise<void> | null = null
  let freshUpdateRequested = false

  async function runUpdates() {
    try {
      do {
        freshUpdateRequested = false
        await runUpdate()
      } while (freshUpdateRequested)
    } finally {
      activeUpdate = null
    }
  }

  function ensureUpdate() {
    if (!activeUpdate) activeUpdate = runUpdates()
    return activeUpdate
  }

  return {
    update: () => ensureUpdate(),
    updateFresh: () => {
      if (activeUpdate) freshUpdateRequested = true
      return ensureUpdate()
    }
  }
}
