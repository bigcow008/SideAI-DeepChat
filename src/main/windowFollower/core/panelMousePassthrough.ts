export type PanelMousePassthroughInput = {
  hasTransparentReserve: boolean
  contentPointerInteractive: boolean
}

export type PanelMousePassthroughDecision = {
  ignoreMouseEvents: boolean
  forward: boolean
}

export function decidePanelMousePassthrough({
  hasTransparentReserve,
  contentPointerInteractive
}: PanelMousePassthroughInput): PanelMousePassthroughDecision {
  if (!hasTransparentReserve || contentPointerInteractive) {
    return { ignoreMouseEvents: false, forward: false }
  }
  return { ignoreMouseEvents: true, forward: true }
}
