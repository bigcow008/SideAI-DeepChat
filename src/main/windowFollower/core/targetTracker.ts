import type { TargetFreshness } from '@shared/windowFollower'

export type { TargetFreshness } from '@shared/windowFollower'

export type TargetState<T> = {
  target: T | null
  freshness: TargetFreshness
  capturedAt: number | null
  error: string | null
}

export function recordLiveTarget<T>(target: T, now: number): TargetState<T> {
  return { target, freshness: 'live', capturedAt: now, error: null }
}

export function retainTargetWhileSelfFocused<T>(state: TargetState<T>): TargetState<T> {
  return state.target ? { ...state, freshness: 'retained', error: null } : state
}

export function recordTargetMiss<T>(
  state: TargetState<T>,
  now: number,
  error: string,
  graceMs: number
): TargetState<T> {
  if (state.target && state.capturedAt !== null && now - state.capturedAt <= graceMs) {
    return { ...state, freshness: 'grace', error }
  }

  return { target: null, freshness: 'unavailable', capturedAt: null, error }
}

export function recordTargetUnavailable<T>(
  _state: TargetState<T>,
  error: string | null
): TargetState<T> {
  return { target: null, freshness: 'unavailable', capturedAt: null, error }
}
