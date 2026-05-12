import type { ExecutionResult } from '../execution/index.js'
import type { TransactionSnapshot } from '../execution/index.js'
import type { StateSnapshot } from '../state/index.js'

export interface ReplaySnapshot {
    readonly executionId: string
    readonly transactionId: string
    readonly message: {
        readonly command: string
        readonly args: readonly string[]
        readonly chatJid: string
    }
    readonly executionResult: ExecutionResult
    readonly transactionSnapshot: TransactionSnapshot | null
    readonly stateSnapshot: StateSnapshot | null
    readonly replayTick: number
    readonly hash: string
}

export function createReplaySnapshot(
    executionResult: ExecutionResult,
    transactionSnapshot: TransactionSnapshot | null,
    stateSnapshot: StateSnapshot | null,
    messageData: { command: string; args: readonly string[]; chatJid: string },
    replayTick: number = 0
): ReplaySnapshot {
    const hash = computeReplayHash(executionResult, transactionSnapshot)

    return Object.freeze({
        executionId: executionResult.executionId,
        transactionId: executionResult.transactionId,
        message: Object.freeze({ ...messageData }),
        executionResult: Object.freeze({ ...executionResult }),
        transactionSnapshot: transactionSnapshot ? Object.freeze({ ...transactionSnapshot }) : null,
        stateSnapshot: stateSnapshot ? Object.freeze({ ...stateSnapshot }) : null,
        replayTick,
        hash
    })
}

function computeReplayHash(executionResult: ExecutionResult, transactionSnapshot: TransactionSnapshot | null): string {
    const data = JSON.stringify({
        executionId: executionResult.executionId,
        transactionId: executionResult.transactionId,
        success: executionResult.success,
        phase: executionResult.phase,
        intents: transactionSnapshot?.intents.map((i: any) => `${i.type}:${i.targetJid}`) || [],
        transitions: executionResult.transitions.map(t => `${t.from}->${t.to}`),
        finalStateHash: executionResult.finalStateHash
    })

    let hash = 0
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return Math.abs(hash).toString(36)
}

export function verifyReplayHash(snapshot: ReplaySnapshot): boolean {
    const expectedHash = computeReplayHash(
        snapshot.executionResult,
        snapshot.transactionSnapshot
    )
    return snapshot.hash === expectedHash
}