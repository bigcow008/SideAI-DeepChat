export type PanelFollowDecisionInput = {
  targetExcluded: boolean
  targetReadable?: boolean
  suppressedForExcludedApp?: boolean
  suppressedOwnerExcluded?: boolean
}

export type PanelFollowDecision = {
  suppressedForExcludedApp: boolean
  shouldApplyFollow: boolean
  shouldSendWindowInfo: boolean
  shouldHidePanel: boolean
}

export function decidePanelFollowForTarget(input: PanelFollowDecisionInput): PanelFollowDecision {
  const shouldStaySuppressed =
    input.suppressedForExcludedApp &&
    input.suppressedOwnerExcluded &&
    input.targetReadable === false

  if (input.targetExcluded || shouldStaySuppressed) {
    return {
      suppressedForExcludedApp: true,
      shouldApplyFollow: false,
      shouldSendWindowInfo: false,
      shouldHidePanel: true
    }
  }

  return {
    suppressedForExcludedApp: false,
    shouldApplyFollow: true,
    shouldSendWindowInfo: true,
    shouldHidePanel: false
  }
}
