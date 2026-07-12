export class TargetReadTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`窗口读取超时（${timeoutMs}ms）`)
    this.name = 'TargetReadTimeoutError'
  }
}

export function monotonicEpochNow() {
  return performance.timeOrigin + performance.now()
}

export function createTimedSingleFlightReader<Arguments extends unknown[], Result>(
  read: (...args: Arguments) => Promise<Result>,
  timeoutMs: number,
  now: () => number = performance.now.bind(performance)
) {
  let activeFlight: { promise: Promise<Result>; deadline: number } | null = null

  return async function readWithTimeout(...args: Arguments): Promise<Result> {
    if (!activeFlight) {
      const nextRead = Promise.resolve().then(() => read(...args))
      const nextFlight = { promise: nextRead, deadline: now() + timeoutMs }
      activeFlight = nextFlight
      void nextRead
        .finally(() => {
          if (activeFlight === nextFlight) {
            activeFlight = null
          }
        })
        .catch(() => {})
    }

    const currentFlight = activeFlight
    const remainingMs = currentFlight.deadline - now()

    if (remainingMs <= 0) {
      throw new TargetReadTimeoutError(timeoutMs)
    }

    let timeout: ReturnType<typeof setTimeout> | null = null
    const readBeforeDeadline = currentFlight.promise.then(
      (result) => {
        if (now() >= currentFlight.deadline) {
          throw new TargetReadTimeoutError(timeoutMs)
        }
        return result
      },
      (error) => {
        if (now() >= currentFlight.deadline) {
          throw new TargetReadTimeoutError(timeoutMs)
        }
        throw error
      }
    )

    try {
      return await Promise.race([
        readBeforeDeadline,
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new TargetReadTimeoutError(timeoutMs)), remainingMs)
        })
      ])
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }
}
