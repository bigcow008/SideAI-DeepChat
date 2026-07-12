import { activeWindow, openWindows } from 'get-windows'

type ActiveWindow = Awaited<ReturnType<typeof activeWindow>>
export type WindowSnapshot = NonNullable<ActiveWindow>
export type WindowReadPermissions = {
  accessibilityPermission: boolean
  screenRecordingPermission: boolean
}
type PermissionReader<T> = (options: WindowReadPermissions) => Promise<T>

const MIN_PRIMARY_WINDOW_WIDTH = 160
const MIN_PRIMARY_WINDOW_HEIGHT = 160
const TRANSIENT_WINDOW_MAX_AREA_RATIO = 0.42
const TRANSIENT_WINDOW_MAX_EDGE_RATIO = 0.72
const TRANSIENT_TITLE_MAX_LENGTH = 24
const TRANSIENT_PROBE_MAX_WIDTH = 640
const TRANSIENT_PROBE_MAX_AREA = 520_000

async function readWithPermissionFallback<T>(
  reader: PermissionReader<T>,
  permissions: WindowReadPermissions
): Promise<T> {
  const attempts = [
    permissions,
    { ...permissions, screenRecordingPermission: false },
    { accessibilityPermission: false, screenRecordingPermission: false }
  ]
  let lastError: unknown

  for (const attempt of attempts) {
    try {
      return await reader(attempt)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export async function readActiveWindowWithBoundsFallback(
  reader: PermissionReader<ActiveWindow>,
  permissions: WindowReadPermissions
) {
  return readWithPermissionFallback(reader, permissions)
}

function windowArea(windowInfo: WindowSnapshot) {
  return windowInfo.bounds.width * windowInfo.bounds.height
}

function isSmallUtilityWindow(windowInfo: WindowSnapshot) {
  return (
    windowInfo.bounds.width < MIN_PRIMARY_WINDOW_WIDTH ||
    windowInfo.bounds.height < MIN_PRIMARY_WINDOW_HEIGHT
  )
}

function sameOwner(a: WindowSnapshot, b: WindowSnapshot) {
  return a.owner.processId === b.owner.processId || a.owner.name === b.owner.name
}

function titleLooksTransient(windowInfo: WindowSnapshot) {
  const title = windowInfo.title?.trim() ?? ''
  return title.length === 0 || title.length <= TRANSIENT_TITLE_MAX_LENGTH
}

function shouldCheckOpenWindowsForReplacement(windowInfo: WindowSnapshot) {
  if (isSmallUtilityWindow(windowInfo)) return true
  return (
    titleLooksTransient(windowInfo) &&
    windowInfo.bounds.width <= TRANSIENT_PROBE_MAX_WIDTH &&
    windowArea(windowInfo) <= TRANSIENT_PROBE_MAX_AREA
  )
}

function isLikelyTransientWindow(active: WindowSnapshot, candidate: WindowSnapshot) {
  if (!sameOwner(active, candidate) || isSmallUtilityWindow(candidate)) return false

  const activeArea = windowArea(active)
  const candidateArea = windowArea(candidate)
  if (candidateArea <= activeArea || !titleLooksTransient(active)) return false

  const areaRatio = activeArea / candidateArea
  const widthRatio = active.bounds.width / candidate.bounds.width
  const heightRatio = active.bounds.height / candidate.bounds.height
  const compactOnOneAxis =
    widthRatio <= TRANSIENT_WINDOW_MAX_EDGE_RATIO || heightRatio <= TRANSIENT_WINDOW_MAX_EDGE_RATIO
  return areaRatio <= TRANSIENT_WINDOW_MAX_AREA_RATIO && compactOnOneAxis
}

function largestMainWindowForActive(active: WindowSnapshot, open: WindowSnapshot[]) {
  return open
    .filter(
      (windowInfo) =>
        windowInfo.id !== active.id &&
        sameOwner(windowInfo, active) &&
        !isSmallUtilityWindow(windowInfo)
    )
    .sort((a, b) => windowArea(b) - windowArea(a))[0]
}

export function selectBestTargetWindow(
  active: ActiveWindow,
  open: WindowSnapshot[] = []
): ActiveWindow {
  if (!active) return active
  const replacement = largestMainWindowForActive(active, open)
  if (!replacement) return active
  return isSmallUtilityWindow(active) || isLikelyTransientWindow(active, replacement)
    ? replacement
    : active
}

export async function readActiveWindowFromReaders(
  activeReader: PermissionReader<ActiveWindow>,
  openReader: PermissionReader<WindowSnapshot[]>,
  permissions: WindowReadPermissions
): Promise<ActiveWindow> {
  const current = await readActiveWindowWithBoundsFallback(activeReader, permissions)
  if (!current || !shouldCheckOpenWindowsForReplacement(current)) return current

  try {
    const windows = await readWithPermissionFallback(openReader, permissions)
    return selectBestTargetWindow(current, windows)
  } catch {
    return current
  }
}

export class GetWindowsAdapter {
  async readActiveWindow(permissions: WindowReadPermissions): Promise<ActiveWindow> {
    return readActiveWindowFromReaders(activeWindow, openWindows, permissions)
  }
}
