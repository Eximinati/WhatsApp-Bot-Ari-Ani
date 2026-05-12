export enum ExecutionMode {
    LIVE = 'LIVE',
    REPLAY = 'REPLAY',
    DRY_RUN = 'DRY_RUN'
}

export interface ClockState {
    readonly tick: number
    readonly mode: ExecutionMode
    readonly sequenceId: string
}

export interface ExecutionClockConfig {
    mode: ExecutionMode
    initialTick?: number
    initialSequenceId?: string
}

export class ExecutionClock {
    private tick: number
    private readonly mode: ExecutionMode
    private sequenceId: string
    private revisionCounter = 0

    constructor(config: ExecutionClockConfig) {
        this.tick = config.initialTick ?? 0
        this.mode = config.mode
        this.sequenceId = config.initialSequenceId ?? `seq-${this.tick.toString().padStart(8, '0')}`
    }

    tickUp(): number {
        this.revisionCounter = 0
        this.tick++
        this.sequenceId = `seq-${this.tick.toString().padStart(8, '0')}`
        return this.tick
    }

    getTick(): number {
        return this.tick
    }

    getMode(): ExecutionMode {
        return this.mode
    }

    getSequenceId(): string {
        return this.sequenceId
    }

    getNextRevision(): number {
        return ++this.revisionCounter
    }

    getRevision(): number {
        return this.revisionCounter
    }

    isReplay(): boolean {
        return this.mode === ExecutionMode.REPLAY
    }

    isDryRun(): boolean {
        return this.mode === ExecutionMode.DRY_RUN
    }

    isLive(): boolean {
        return this.mode === ExecutionMode.LIVE
    }

    canSendTransport(): boolean {
        return this.mode === ExecutionMode.LIVE
    }

    getTickSequence(): string {
        return `t${this.tick.toString().padStart(6, '0')}`
    }

    getDeterministicId(prefix: string): string {
        return `${prefix}-${this.sequenceId}-r${this.getNextRevision()}`
    }

    getState(): ClockState {
        return Object.freeze({
            tick: this.tick,
            mode: this.mode,
            sequenceId: this.sequenceId
        })
    }

    restoreState(state: ClockState): void {
        this.tick = state.tick
        this.sequenceId = state.sequenceId
        this.revisionCounter = 0
    }

    fork(): ExecutionClock {
        return new ExecutionClock({
            mode: this.mode,
            initialTick: this.tick,
            initialSequenceId: this.sequenceId
        })
    }
}

export function createLiveClock(): ExecutionClock {
    return new ExecutionClock({ mode: ExecutionMode.LIVE })
}

export function createReplayClock(initialTick?: number): ExecutionClock {
    return new ExecutionClock({ mode: ExecutionMode.REPLAY, initialTick })
}

export function createDryRunClock(): ExecutionClock {
    return new ExecutionClock({ mode: ExecutionMode.DRY_RUN })
}

export function createClockFromState(state: ClockState): ExecutionClock {
    return new ExecutionClock({
        mode: state.mode,
        initialTick: state.tick,
        initialSequenceId: state.sequenceId
    })
}