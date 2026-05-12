import { ExecutionClock, ExecutionMode, type ClockState } from './ExecutionClock.js'

let globalExecutionIdCounter = 0
let globalTransactionIdCounter = 0
let globalIntentIdCounter = 0
let globalSnapshotIdCounter = 0
let globalAuditIdCounter = 0

export function resetGlobalCounters(): void {
    globalExecutionIdCounter = 0
    globalTransactionIdCounter = 0
    globalIntentIdCounter = 0
    globalSnapshotIdCounter = 0
    globalAuditIdCounter = 0
}

export function getNextExecutionId(): string {
    return `exec-${++globalExecutionIdCounter}`
}

export function getNextTransactionId(): string {
    return `txn-${++globalTransactionIdCounter}`
}

export function getNextIntentId(prefix?: string): string {
    const seq = ++globalIntentIdCounter
    return `${prefix || 'intent'}-${seq.toString().padStart(6, '0')}`
}

export function getNextSnapshotId(): string {
    return `snap-${++globalSnapshotIdCounter}`
}

export function getNextAuditId(): string {
    return `audit-${++globalAuditIdCounter}`
}

export function getExecutionSequence(): number {
    return globalExecutionIdCounter
}

export function getTransactionSequence(): number {
    return globalTransactionIdCounter
}

export function getIntentSequence(): number {
    return globalIntentIdCounter
}

export interface DeterministicClockConfig {
    mode: ExecutionMode
    initialTick?: number
    initialSequenceId?: number
}

export class DeterministicClock {
    private readonly clock: ExecutionClock
    private readonly initialState: ClockState

    constructor(config: DeterministicClockConfig) {
        const seqId = config.initialSequenceId ?? 0
        this.clock = new ExecutionClock({
            mode: config.mode,
            initialTick: config.initialTick ?? 0,
            initialSequenceId: `seq-${seqId.toString().padStart(8, '0')}`
        })
        this.initialState = this.clock.getState()
    }

    tick(): number {
        return this.clock.tickUp()
    }

    getTick(): number {
        return this.clock.getTick()
    }

    getMode(): ExecutionMode {
        return this.clock.getMode()
    }

    getSequenceId(): string {
        return this.clock.getSequenceId()
    }

    getNextRevision(): number {
        return this.clock.getNextRevision()
    }

    getRevision(): number {
        return this.clock.getRevision()
    }

    isReplay(): boolean {
        return this.clock.isReplay()
    }

    isDryRun(): boolean {
        return this.clock.isDryRun()
    }

    isLive(): boolean {
        return this.clock.isLive()
    }

    canSendTransport(): boolean {
        return this.clock.canSendTransport()
    }

    getTickSequence(): string {
        return this.clock.getTickSequence()
    }

    getDeterministicId(prefix: string): string {
        return `${prefix}-${this.getTickSequence()}-r${this.getNextRevision()}`
    }

    generateExecutionId(): string {
        return getNextExecutionId()
    }

    generateTransactionId(): string {
        return getNextTransactionId()
    }

    generateIntentId(prefix?: string): string {
        return getNextIntentId(prefix)
    }

    generateSnapshotId(): string {
        return getNextSnapshotId()
    }

    generateAuditId(): string {
        return getNextAuditId()
    }

    getState(): ClockState {
        return this.clock.getState()
    }

    restoreState(state: ClockState): void {
        this.clock.restoreState(state)
    }

    getInitialState(): ClockState {
        return this.initialState
    }

    fork(): DeterministicClock {
        return new DeterministicClock({
            mode: this.clock.getMode(),
            initialTick: this.clock.getTick(),
            initialSequenceId: parseInt(this.clock.getSequenceId().split('-')[1], 10)
        })
    }

    isAtTickZero(): boolean {
        return this.getTick() === 0
    }
}

export function createDeterministicLiveClock(initialTick?: number): DeterministicClock {
    return new DeterministicClock({ mode: ExecutionMode.LIVE, initialTick })
}

export function createDeterministicReplayClock(initialTick?: number): DeterministicClock {
    return new DeterministicClock({ mode: ExecutionMode.REPLAY, initialTick })
}

export function createDeterministicDryRunClock(): DeterministicClock {
    return new DeterministicClock({ mode: ExecutionMode.DRY_RUN })
}

export function createDeterministicFromState(state: ClockState): DeterministicClock {
    return new DeterministicClock({
        mode: state.mode,
        initialTick: state.tick,
        initialSequenceId: parseInt(state.sequenceId.split('-')[1], 10)
    })
}