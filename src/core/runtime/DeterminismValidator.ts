import type { NormalizedMessage } from '../serializer/types.js'
import type { CommandDescriptor } from '../dispatcher/types.js'
import type { ExecutionResult } from '../execution/ExecutionCoordinator.js'
import type { TransportIntent } from '../transport/types.js'

export interface DeterminismClaim {
    type: 'state_hash' | 'transitions' | 'intents' | 'commit_decision' | 'snapshot'
    description: string
    verified: boolean
    value?: string
    replayValue?: string
}

export interface DeterminismProof {
    executionId: string
    command: string
    inputHash: string
    claims: DeterminismClaim[]
    overallDeterministic: boolean
    divergenceCount: number
    timestamp: number
}

export interface ReplayComparison {
    original: ExecutionResult
    replay: ExecutionResult
    matches: boolean
    differences: Array<{
        field: string
        original: string
        replay: string
        severity: 'critical' | 'warning' | 'info'
    }>
}

export class DeterminismValidator {
    private proofs: DeterminismProof[] = []

    async verifyDeterminism(
        executeFn: (msg: NormalizedMessage) => Promise<ExecutionResult>,
        message: NormalizedMessage,
        repeatCount: number = 5,
        resetFn?: () => void | Promise<void>
    ): Promise<DeterminismProof> {
        const results: ExecutionResult[] = []

        for (let i = 0; i < repeatCount; i++) {
            if (resetFn) {
                await resetFn()
            }
            const result = await executeFn(message)
            results.push(result)
        }

        const proof = this.buildProof(message, results)
        this.proofs.push(proof)

        return proof
    }

    private buildProof(message: NormalizedMessage, results: ExecutionResult[]): DeterminismProof {
        const inputHash = this.hashInput(message)
        const first = results[0]

        const claims: DeterminismClaim[] = []

        const stateHashes = results.map(r => r.finalStateHash)
        const uniqueStateHashes = new Set(stateHashes)
        claims.push({
            type: 'state_hash',
            description: 'Same command + same state produces same state hash',
            verified: uniqueStateHashes.size === 1,
            value: first.finalStateHash,
            replayValue: uniqueStateHashes.size === 1 ? undefined : [...uniqueStateHashes].join(' vs ')
        })

        const transitionStrings = results.map(r => r.transitions.map((t: any) => t.from + '->' + t.to).join('|'))
        const uniqueTransitions = new Set(transitionStrings)
        claims.push({
            type: 'transitions',
            description: 'Same command produces identical transition sequence',
            verified: uniqueTransitions.size === 1,
            value: transitionStrings[0],
            replayValue: uniqueTransitions.size === 1 ? undefined : [...uniqueTransitions].join(' vs ')
        })

        const intentStrings = results.map(r => r.intents.map((i: any) => i.type + ':' + i.sequence).join('|'))
        const uniqueIntents = new Set(intentStrings)
        claims.push({
            type: 'intents',
            description: 'Same command produces identical intent sequence',
            verified: uniqueIntents.size === 1,
            value: intentStrings[0],
            replayValue: uniqueIntents.size === 1 ? undefined : [...uniqueIntents].join(' vs ')
        })

        const decisions = results.map(r => r.commitDecision)
        const uniqueDecisions = new Set(decisions)
        claims.push({
            type: 'commit_decision',
            description: 'Same command produces identical commit decision',
            verified: uniqueDecisions.size === 1,
            value: first.commitDecision,
            replayValue: uniqueDecisions.size === 1 ? undefined : [...uniqueDecisions].join(' vs ')
        })

        const snapshotHashes = results.map(r => r.stateSnapshotHash || '')
        const uniqueSnapshots = new Set(snapshotHashes.filter((h: string) => h))
        claims.push({
            type: 'snapshot',
            description: 'Same command produces identical state snapshot hash',
            verified: uniqueSnapshots.size <= 1,
            value: first.stateSnapshotHash || 'none',
            replayValue: uniqueSnapshots.size > 1 ? [...uniqueSnapshots].join(' vs ') : undefined
        })

        const divergenceCount = claims.filter(c => !c.verified).length

        return {
            executionId: first.executionId,
            command: message.command || 'unknown',
            inputHash,
            claims,
            overallDeterministic: divergenceCount === 0,
            divergenceCount,
            timestamp: Date.now()
        }
    }

    private hashInput(message: NormalizedMessage): string {
        const data = JSON.stringify({
            command: message.command,
            args: message.args,
            senderJid: message.senderJid,
            chatJid: message.chatJid,
            chatType: message.chatType
        })
        return this.simpleHash(data)
    }

    private simpleHash(str: string): string {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash
        }
        return Math.abs(hash).toString(36)
    }

    getProofs(): DeterminismProof[] {
        return [...this.proofs]
    }

    getVerifiedClaimCount(): number {
        return this.proofs.reduce((acc, p) => acc + p.claims.filter(c => c.verified).length, 0)
    }

    getTotalClaimCount(): number {
        return this.proofs.reduce((acc, p) => acc + p.claims.length, 0)
    }

    getDeterministicExecutionCount(): number {
        return this.proofs.filter(p => p.overallDeterministic).length
    }

    reset(): void {
        this.proofs = []
    }
}

export class ReplayDiffAnalyzer {
    compare(original: ExecutionResult, replay: ExecutionResult): ReplayComparison {
        const differences: ReplayComparison['differences'] = []

        if (original.finalStateHash !== replay.finalStateHash) {
            differences.push({
                field: 'finalStateHash',
                original: original.finalStateHash,
                replay: replay.finalStateHash,
                severity: 'critical' as const
            })
        }

        if (original.commitDecision !== replay.commitDecision) {
            differences.push({
                field: 'commitDecision',
                original: original.commitDecision,
                replay: replay.commitDecision,
                severity: 'critical' as const
            })
        }

        const origTransitions = original.transitions.map((t: any) => t.from + '->' + t.to + '@' + t.tick)
        const replayTransitions = replay.transitions.map((t: any) => t.from + '->' + t.to + '@' + t.tick)
        if (JSON.stringify(origTransitions) !== JSON.stringify(replayTransitions)) {
            differences.push({
                field: 'transitions',
                original: origTransitions.join('|'),
                replay: replayTransitions.join('|'),
                severity: 'critical' as const
            })
        }

        const origIntents = original.intents.map((i: any) => i.type + ':' + i.sequence + ':' + i.targetJid)
        const replayIntents = replay.intents.map((i: any) => i.type + ':' + i.sequence + ':' + i.targetJid)
        if (JSON.stringify(origIntents) !== JSON.stringify(replayIntents)) {
            differences.push({
                field: 'intents',
                original: origIntents.join('|'),
                replay: replayIntents.join('|'),
                severity: 'critical' as const
            })
        }

        if (original.success !== replay.success) {
            differences.push({
                field: 'success',
                original: String(original.success),
                replay: String(replay.success),
                severity: 'critical' as const
            })
        }

        if (original.phase !== replay.phase) {
            differences.push({
                field: 'phase',
                original: original.phase,
                replay: replay.phase,
                severity: 'warning' as const
            })
        }

        if (original.durationMs !== replay.durationMs) {
            differences.push({
                field: 'durationMs',
                original: String(original.durationMs),
                replay: String(replay.durationMs),
                severity: 'info' as const
            })
        }

        if (original.stateSnapshotHash && replay.stateSnapshotHash &&
            original.stateSnapshotHash !== replay.stateSnapshotHash) {
            differences.push({
                field: 'stateSnapshotHash',
                original: original.stateSnapshotHash,
                replay: replay.stateSnapshotHash,
                severity: 'warning' as const
            })
        }

        return {
            original,
            replay,
            matches: differences.filter(d => d.severity === 'critical').length === 0,
            differences
        }
    }

    generateReport(comparison: ReplayComparison): string {
        const lines: string[] = []
        lines.push('=== REPLAY DIVERGENCE REPORT ===')
        lines.push('Status: ' + (comparison.matches ? 'MATCH' : 'DIVERGED'))
        lines.push('')

        if (comparison.matches) {
            lines.push('All critical fields match. Replay is consistent.')
            return lines.join('\n')
        }

        lines.push('Found ' + comparison.differences.length + ' differences:')
        lines.push('')

        for (const diff of comparison.differences) {
            let severityStr = 'INFO'
            if (diff.severity === 'critical') severityStr = 'CRITICAL'
            else if (diff.severity === 'warning') severityStr = 'WARNING'
            lines.push('[' + severityStr + '] ' + diff.field + ':')
            lines.push('  Original: ' + diff.original)
            lines.push('  Replay:   ' + diff.replay)
            lines.push('')
        }

        return lines.join('\n')
    }
}