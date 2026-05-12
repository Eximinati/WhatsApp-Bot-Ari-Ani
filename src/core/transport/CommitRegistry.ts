import { ExecutionClock } from '../execution/ExecutionClock.js'

export interface CommitRecord {
    readonly intentId: string
    readonly transactionId: string
    readonly committedTick: number
    readonly success: boolean
    readonly error?: Error
}

export interface CommitRegistryConfig {
    readonly maxRecords?: number
    readonly clock?: ExecutionClock
}

let fallbackTickCounter = 0

export class CommitRegistry {
    private committed = new Map<string, CommitRecord>()
    private readonly maxRecords: number
    private readonly clock?: ExecutionClock

    constructor(config: CommitRegistryConfig = {}) {
        this.maxRecords = config.maxRecords ?? 10000
        this.clock = config.clock
    }

    private getCommitTick(): number {
        return this.clock?.getTick() ?? ++fallbackTickCounter
    }

    isCommitted(intentId: string): boolean {
        return this.committed.has(intentId)
    }

    getRecord(intentId: string): CommitRecord | undefined {
        return this.committed.get(intentId)
    }

    recordCommit(intentId: string, transactionId: string, success: boolean, error?: Error): void {
        if (this.committed.has(intentId)) {
            return
        }

        const record: CommitRecord = Object.freeze({
            intentId,
            transactionId,
            committedTick: this.getCommitTick(),
            success,
            error
        })

        this.committed.set(intentId, record)

        if (this.committed.size > this.maxRecords) {
            const firstKey = this.committed.keys().next().value
            if (firstKey) {
                this.committed.delete(firstKey)
            }
        }
    }

    getCommittedCount(): number {
        return this.committed.size
    }

    clear(): void {
        this.committed.clear()
    }

    getAllRecords(): readonly CommitRecord[] {
        return Object.freeze([...this.committed.values()])
    }
}