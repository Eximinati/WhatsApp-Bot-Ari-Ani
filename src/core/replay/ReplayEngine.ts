import type { ExecutionResult } from '../execution/index.js'
import type { TransactionSnapshot } from '../execution/index.js'
import type { StateSnapshot } from '../state/index.js'
import { ReplaySnapshot, createReplaySnapshot } from './ReplaySnapshot.js'
import { RealReplayValidator, type DivergenceReport } from './ReplayValidator.js'

export interface ReplayConfig {
    readonly maxSnapshots: number
    readonly enableValidation: boolean
}

export class ReplayEngine {
    private readonly config: ReplayConfig
    private readonly validator: RealReplayValidator
    private snapshots: ReplaySnapshot[] = []

    constructor(config: ReplayConfig) {
        this.config = config
        this.validator = new RealReplayValidator()
    }

    captureExecution(
        executionResult: ExecutionResult,
        transactionSnapshot: TransactionSnapshot | null,
        stateSnapshot: StateSnapshot | null,
        messageData: { command: string; args: readonly string[]; chatJid: string }
    ): ReplaySnapshot {
        const snapshot = createReplaySnapshot(executionResult, transactionSnapshot, stateSnapshot, messageData)
        this.snapshots.push(snapshot)

        if (this.snapshots.length > this.config.maxSnapshots) {
            this.snapshots.shift()
        }

        return snapshot
    }

    replayExecution(executionId: string): ReplaySnapshot | null {
        const original = this.snapshots.find(s => s.executionId === executionId)
        if (!original) return null
        return original
    }

    verifyDeterminism(executionId: string, newExecutionResult: ExecutionResult): DivergenceReport {
        const original = this.snapshots.find(s => s.executionId === executionId)
        if (!original) {
            return {
                executionId,
                isDeterministic: false,
                diffs: [{ phase: 'EXECUTION' as any, path: 'execution', expected: executionId, actual: 'NOT_FOUND', divergenceReason: 'Original execution not found' }],
                expectedTransitions: [],
                actualTransitions: [],
                expectedIntents: [],
                actualIntents: [],
                expectedHash: '',
                actualHash: ''
            }
        }

        return this.validator.validate(original.executionResult, newExecutionResult, original.transactionSnapshot ?? null, null)
    }

    getSnapshots(): readonly ReplaySnapshot[] {
        return Object.freeze([...this.snapshots])
    }

    getSnapshot(executionId: string): ReplaySnapshot | undefined {
        return this.snapshots.find(s => s.executionId === executionId)
    }

    clearSnapshots(): void {
        this.snapshots.length = 0
    }

    getSnapshotCount(): number {
        return this.snapshots.length
    }
}