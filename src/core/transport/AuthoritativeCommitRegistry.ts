import { ExecutionMode } from '../execution/ExecutionClock.js'

export enum CommitState {
    RESERVED = 'RESERVED',
    COMMITTED = 'COMMITTED',
    FAILED = 'FAILED'
}

export interface CommitReservation {
    intentId: string
    transactionId: string
    state: CommitState
    reservedAtTick: number
    committedAtTick?: number
    error?: Error
}

export class AuthoritativeCommitRegistry {
    private reservations = new Map<string, CommitReservation>()
    private executionMode: ExecutionMode = ExecutionMode.LIVE
    private lastCommittedTick = 0
    private lastReservedTick = 0
    private committedTransactionIds = new Set<string>()
    private intentExecutionCounts = new Map<string, number>()
    private maxReservations = 1000
    private committedIdsList: string[] = []

    setExecutionMode(mode: ExecutionMode): void {
        this.executionMode = mode
    }

    getExecutionMode(): ExecutionMode {
        return this.executionMode
    }

    canCommit(): boolean {
        return this.executionMode === ExecutionMode.LIVE
    }

    canReserve(intentId: string): boolean {
        if (this.executionMode !== ExecutionMode.LIVE) {
            return false
        }

        const existing = this.reservations.get(intentId)
        if (existing && (existing.state === CommitState.COMMITTED || existing.state === CommitState.RESERVED)) {
            return false
        }
        return true
    }

    reserve(intentId: string, transactionId: string, currentTick: number): CommitReservation | null {
        if (this.executionMode !== ExecutionMode.LIVE) {
            return null
        }

        if (currentTick < this.lastReservedTick) {
            return null
        }
        this.lastReservedTick = currentTick

        const existing = this.reservations.get(intentId)
        if (existing && existing.state !== CommitState.FAILED) {
            return existing
        }

        const reservation: CommitReservation = Object.freeze({
            intentId,
            transactionId,
            state: CommitState.RESERVED,
            reservedAtTick: currentTick
        })

        this.reservations.set(intentId, reservation)
        return reservation
    }

    markCommitted(intentId: string, committedAtTick: number): CommitReservation | null {
        if (committedAtTick < this.lastCommittedTick) {
            return null
        }

        const existing = this.reservations.get(intentId)
        if (!existing) {
            return null
        }

        if (existing.state === CommitState.COMMITTED) {
            return existing
        }

        this.lastCommittedTick = committedAtTick

        const updated: CommitReservation = Object.freeze({
            ...existing,
            state: CommitState.COMMITTED,
            committedAtTick
        })

        this.reservations.set(intentId, updated)
        this.committedIdsList.push(intentId)

        const executionCount = this.intentExecutionCounts.get(intentId) ?? 0
        this.intentExecutionCounts.set(intentId, executionCount + 1)

        while (this.reservations.size > this.maxReservations) {
            const oldestKey = this.reservations.keys().next().value
            if (oldestKey) {
                this.reservations.delete(oldestKey)
            }
        }

        return updated
    }

    markFailed(intentId: string, error: Error): CommitReservation | null {
        const existing = this.reservations.get(intentId)
        if (!existing) {
            return null
        }

        const updated: CommitReservation = Object.freeze({
            ...existing,
            state: CommitState.FAILED,
            error
        })

        this.reservations.set(intentId, updated)
        return updated
    }

    isCommitted(intentId: string): boolean {
        const existing = this.reservations.get(intentId)
        return existing?.state === CommitState.COMMITTED
    }

    isReserved(intentId: string): boolean {
        const existing = this.reservations.get(intentId)
        return existing?.state === CommitState.RESERVED
    }

    isTransactionCommitted(transactionId: string): boolean {
        return this.committedTransactionIds.has(transactionId)
    }

    markTransactionCommitted(transactionId: string): void {
        this.committedTransactionIds.add(transactionId)
    }

    getIntentExecutionCount(intentId: string): number {
        return this.intentExecutionCounts.get(intentId) ?? 0
    }

    getReservation(intentId: string): CommitReservation | undefined {
        return this.reservations.get(intentId)
    }

    getAllReservations(): readonly CommitReservation[] {
        return Object.freeze([...this.reservations.values()])
    }

    getCommittedCount(): number {
        let count = 0
        for (const r of this.reservations.values()) {
            if (r.state === CommitState.COMMITTED) count++
        }
        return count
    }

    clear(): void {
        this.reservations.clear()
        this.committedTransactionIds.clear()
        this.intentExecutionCounts.clear()
    }

    resetForReplay(): void {
        this.lastCommittedTick = 0
        this.lastReservedTick = 0
    }
}