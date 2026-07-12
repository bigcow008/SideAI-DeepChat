import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PendingInputCoordinator } from '@/presenter/agentRuntimePresenter/pendingInputCoordinator'
import type { PendingSessionInputRecord } from '@shared/types/agent-interface'

vi.mock('@/eventbus', () => ({
  eventBus: {}
}))

vi.mock('@/events', () => ({
  SESSION_EVENTS: {
    PENDING_INPUTS_UPDATED: 'session:pending-inputs-updated'
  }
}))

vi.mock('@/routes/publishDeepchatEvent', () => ({
  publishDeepchatEvent: vi.fn()
}))

function createRecord(
  id: string,
  sessionId: string,
  mode: PendingSessionInputRecord['mode']
): PendingSessionInputRecord {
  return {
    id,
    sessionId,
    mode,
    state: 'claimed',
    payload: {
      text: id,
      files: []
    },
    queueOrder: mode === 'queue' ? 1 : null,
    claimedAt: 1,
    consumedAt: null,
    createdAt: 1,
    updatedAt: 1
  }
}

function createCoordinator(records: Map<string, PendingSessionInputRecord>) {
  const store = {
    getInput: vi.fn((itemId: string) => records.get(itemId) ?? null),
    releaseClaimedQueueInput: vi.fn((itemId: string) => records.get(itemId)!),
    releaseClaimedInput: vi.fn((itemId: string) => records.get(itemId)!),
    consumeQueueInput: vi.fn((itemId: string) => {
      records.delete(itemId)
    }),
    consumeSteerInput: vi.fn((itemId: string) => {
      const record = records.get(itemId)
      if (record) {
        records.set(itemId, {
          ...record,
          state: 'consumed',
          consumedAt: 2
        })
      }
    })
  }

  return {
    coordinator: new PendingInputCoordinator(store as any),
    store
  }
}

describe('PendingInputCoordinator claimed input ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not release a claimed queue input from another session', () => {
    const records = new Map<string, PendingSessionInputRecord>([
      ['queue-1', createRecord('queue-1', 'session-2', 'queue')]
    ])
    const { coordinator, store } = createCoordinator(records)

    expect(() => coordinator.releaseClaimedQueueInput('session-1', 'queue-1')).toThrow(
      'does not belong to session session-1'
    )
    expect(store.releaseClaimedQueueInput).not.toHaveBeenCalled()
  })

  it('does not consume a claimed steer input from another session', () => {
    const records = new Map<string, PendingSessionInputRecord>([
      ['steer-1', createRecord('steer-1', 'session-2', 'steer')]
    ])
    const { coordinator, store } = createCoordinator(records)

    expect(() => coordinator.consumeSteerInput('session-1', 'steer-1')).toThrow(
      'does not belong to session session-1'
    )
    expect(store.consumeSteerInput).not.toHaveBeenCalled()
  })

  it('preserves trusted window context before handing input to the store', () => {
    const windowContext = {
      schemaVersion: 1 as const,
      trackingState: 'following' as const,
      source: 'active' as const,
      freshness: 'live' as const,
      capturedAt: 1,
      lastVerifiedAt: 1,
      app: { stableKey: 'bundleId:code', name: 'Code', processId: 42 },
      window: {
        windowId: 7,
        title: 'PRD.md - SideAI',
        bounds: { x: 0, y: 0, width: 900, height: 700 }
      },
      permissions: {
        platform: 'macos' as const,
        accessibility: 'granted' as const,
        screenRecording: 'granted' as const,
        checkedAt: 1
      }
    }
    const record = createRecord('queue-context', 'session-1', 'queue')
    const store = {
      countActiveQueue: vi.fn(() => 0),
      createQueueInputWithState: vi.fn(() => record)
    }
    const coordinator = new PendingInputCoordinator(store as any)

    coordinator.queuePendingInput('session-1', {
      text: 'Review',
      files: [],
      windowContext
    })

    expect(store.createQueueInputWithState).toHaveBeenCalledWith(
      'session-1',
      { text: 'Review', files: [], windowContext },
      'pending'
    )
  })
})

describe('PendingInputCoordinator pending steer recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createPending(
    id: string,
    sessionId: string,
    mode: 'queue' | 'steer'
  ): PendingSessionInputRecord {
    return {
      id,
      sessionId,
      mode,
      state: 'pending',
      payload: { text: id, files: [] },
      queueOrder: mode === 'queue' ? 1 : null,
      claimedAt: null,
      consumedAt: null,
      createdAt: 1,
      updatedAt: 1
    }
  }

  it('deletes a pending steer item (recovery escape hatch for a stranded promotion)', () => {
    const steer = createPending('steer-1', 'session-1', 'steer')
    const store = {
      listPendingInputs: vi.fn(() => [steer]),
      deleteInput: vi.fn()
    }
    const coordinator = new PendingInputCoordinator(store as any)

    expect(() => coordinator.deletePendingInput('session-1', 'steer-1')).not.toThrow()
    expect(store.deleteInput).toHaveBeenCalledWith('steer-1')
  })

  it('restores a pending steer item back to the queue', () => {
    const steer = createPending('steer-1', 'session-1', 'steer')
    const store = {
      listPendingInputs: vi.fn(() => [steer]),
      convertSteerInputToQueue: vi.fn(() => ({ ...steer, mode: 'queue' as const, queueOrder: 1 }))
    }
    const coordinator = new PendingInputCoordinator(store as any)

    const result = coordinator.restoreSteerInputToQueue('session-1', 'steer-1')
    expect(store.convertSteerInputToQueue).toHaveBeenCalledWith('steer-1')
    expect(result.mode).toBe('queue')
  })

  it('rejects deleting a pending input that does not exist', () => {
    const store = {
      listPendingInputs: vi.fn(() => []),
      deleteInput: vi.fn()
    }
    const coordinator = new PendingInputCoordinator(store as any)

    expect(() => coordinator.deletePendingInput('session-1', 'missing')).toThrow(
      'Pending input not found'
    )
    expect(store.deleteInput).not.toHaveBeenCalled()
  })
})
