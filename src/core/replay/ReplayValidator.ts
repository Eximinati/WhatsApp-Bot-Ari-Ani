import type { ExecutionResult } from '../execution/ExecutionCoordinator.js'
import type { TransactionSnapshot } from '../execution/ExecutionCoordinator.js'
import type { StateSnapshot } from '../state/StateManager.js'

export enum DivergencePhase {
    EXECUTION = 'EXECUTION',
    PRE_COMMIT = 'PRE_COMMIT',
    COMMITTING = 'COMMITTING',
    POST_COMMIT = 'POST_COMMIT',
    FINALIZATION = 'FINALIZATION'
}

export interface ReplayDiff {
    phase: DivergencePhase
    path: string
    expected: unknown
    actual: unknown
    divergenceReason: string
}

export interface DivergenceReport {
    executionId: string
    isDeterministic: boolean
    diffs: readonly ReplayDiff[]
    expectedTransitions: readonly string[]
    actualTransitions: readonly string[]
    expectedIntents: readonly string[]
    actualIntents: readonly string[]
    expectedHash: string
    actualHash: string
}

export class RealReplayValidator {
    validate(
        originalResult: ExecutionResult,
        replayedResult: ExecutionResult,
        originalTransaction: TransactionSnapshot | null,
        replayedTransaction: TransactionSnapshot | null
    ): DivergenceReport {
        const diffs: ReplayDiff[] = []

        if (originalResult.executionId !== replayedResult.executionId) {
            diffs.push({
                phase: DivergencePhase.EXECUTION,
                path: 'executionId',
                expected: originalResult.executionId,
                actual: replayedResult.executionId,
                divergenceReason: 'Execution ID changed (expected - deterministic IDs should match)'
            })
        }

        if (originalResult.transactionId !== replayedResult.transactionId) {
            diffs.push({
                phase: DivergencePhase.EXECUTION,
                path: 'transactionId',
                expected: originalResult.transactionId,
                actual: replayedResult.transactionId,
                divergenceReason: 'Transaction ID changed'
            })
        }

        const expectedTransitions = originalResult.transitions.map(t => `${t.from}->${t.to}`)
        const actualTransitions = replayedResult.transitions.map(t => `${t.from}->${t.to}`)

        if (expectedTransitions.join('|') !== actualTransitions.join('|')) {
            diffs.push({
                phase: DivergencePhase.FINALIZATION,
                path: 'transitions',
                expected: expectedTransitions.join('|'),
                actual: actualTransitions.join('|'),
                divergenceReason: 'Transition sequence changed'
            })
        }

        const expectedIntents = originalResult.intents.map(i => `${i.type}:${i.targetJid}`)
        const actualIntents = replayedResult.intents.map(i => `${i.type}:${i.targetJid}`)

        if (expectedIntents.join('|') !== actualIntents.join('|')) {
            diffs.push({
                phase: DivergencePhase.COMMITTING,
                path: 'intents',
                expected: expectedIntents.join('|'),
                actual: actualIntents.join('|'),
                divergenceReason: 'Intent sequence changed'
            })
        }

        if (originalResult.finalStateHash !== replayedResult.finalStateHash) {
            diffs.push({
                phase: DivergencePhase.FINALIZATION,
                path: 'finalStateHash',
                expected: originalResult.finalStateHash,
                actual: replayedResult.finalStateHash,
                divergenceReason: 'State hash changed - deterministic execution violated'
            })
        }

        if (originalResult.success !== replayedResult.success) {
            diffs.push({
                phase: DivergencePhase.EXECUTION,
                path: 'success',
                expected: originalResult.success,
                actual: replayedResult.success,
                divergenceReason: 'Execution outcome changed'
            })
        }

        if (originalResult.phase !== replayedResult.phase) {
            diffs.push({
                phase: DivergencePhase.FINALIZATION,
                path: 'phase',
                expected: originalResult.phase,
                actual: replayedResult.phase,
                divergenceReason: 'Final phase changed'
            })
        }

        return {
            executionId: originalResult.executionId,
            isDeterministic: diffs.length === 0,
            diffs: Object.freeze(diffs),
            expectedTransitions: Object.freeze(expectedTransitions),
            actualTransitions: Object.freeze(actualTransitions),
            expectedIntents: Object.freeze(expectedIntents),
            actualIntents: Object.freeze(actualIntents),
            expectedHash: originalResult.finalStateHash,
            actualHash: replayedResult.finalStateHash
        }
    }

    verifyDeterminism(
        results: readonly ExecutionResult[]
    ): { isDeterministic: boolean; firstDivergence: DivergenceReport | null } {
        if (results.length < 2) {
            return { isDeterministic: true, firstDivergence: null }
        }

        const first = results[0]

        for (let i = 1; i < results.length; i++) {
            const report = this.validate(first, results[i], null, null)
            if (!report.isDeterministic) {
                return { isDeterministic: false, firstDivergence: report }
            }
        }

        return { isDeterministic: true, firstDivergence: null }
    }
}