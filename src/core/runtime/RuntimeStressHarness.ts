import type { NormalizedMessage } from '../serializer/types.js'
import type { CommandDescriptor } from '../dispatcher/types.js'
import { ExecutionCoordinator, ExecutionPhase, type ExecutionResult } from '../execution/index.js'
import { AuthoritativeCommitRegistry, CommitState } from '../transport/AuthoritativeCommitRegistry.js'
import { RuntimeMode } from '../kernel/RuntimeKernel.js'
import type { StateSnapshot } from '../state/index.js'

export interface StressConfig {
    concurrentCommands: number
    repeatCount: number
    enableDuplicateCommits: boolean
    enableMiddlewareVeto: boolean
    enableTransportFailure: boolean
    enableHandlerCrash: boolean
}

export interface StressResult {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    duplicateCommitsAttempted: number
    duplicateCommitsSucceeded: number
    middlewareVetoes: number
    transportFailures: number
    handlerCrashes: number
    invariantViolations: string[]
    executionTimes: number[]
    divergenceCount: number
}

export interface ExecutionRecord {
    executionId: string
    transactionId: string
    command: string
    phase: ExecutionPhase
    finalStateHash: string
    transitions: string[]
    intents: string[]
    commitDecision: string
    timestamp: number
    stateSnapshotHash?: string
}

export class RuntimeStressHarness {
    private records: ExecutionRecord[] = []
    private commitRegistry: AuthoritativeCommitRegistry
    private executionCounter = 0

    constructor() {
        this.commitRegistry = new AuthoritativeCommitRegistry()
    }

    reset(): void {
        this.records = []
        this.commitRegistry.clear()
        this.executionCounter = 0
    }

    async runConcurrentCommands(
        executeFn: (descriptor: CommandDescriptor, message: NormalizedMessage) => Promise<ExecutionResult>,
        descriptor: CommandDescriptor,
        message: NormalizedMessage,
        config: StressConfig
    ): Promise<StressResult> {
        const result: StressResult = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            duplicateCommitsAttempted: 0,
            duplicateCommitsSucceeded: 0,
            middlewareVetoes: 0,
            transportFailures: 0,
            handlerCrashes: 0,
            invariantViolations: [],
            executionTimes: [],
            divergenceCount: 0
        }

        const promises: Promise<void>[] = []

        for (let i = 0; i < config.concurrentCommands; i++) {
            const promise = this.executeWithStress(
                executeFn,
                descriptor,
                { ...message, id: `msg-${i}` },
                config,
                result
            ).then(() => {})
            promises.push(promise)
        }

        await Promise.all(promises)

        result.divergenceCount = this.checkDeterminism()

        return result
    }

    private async executeWithStress(
        executeFn: (descriptor: CommandDescriptor, message: NormalizedMessage) => Promise<ExecutionResult>,
        descriptor: CommandDescriptor,
        message: NormalizedMessage,
        config: StressConfig,
        result: StressResult
    ): Promise<void> {
        const startTime = Date.now()
        this.executionCounter++

        try {
            const execResult = await executeFn(descriptor, message)

            result.totalExecutions++
            result.executionTimes.push(Date.now() - startTime)

            if (execResult.success) {
                result.successfulExecutions++
            } else {
                result.failedExecutions++
            }

            if (execResult.error) {
                if (execResult.error.message.includes('veto')) {
                    result.middlewareVetoes++
                } else if (execResult.error.message.includes('transport') || execResult.error.message.includes('commit')) {
                    result.transportFailures++
                } else if (execResult.error.message.includes('crash') || execResult.error.message.includes('handler')) {
                    result.handlerCrashes++
                }
            }

            this.recordExecution(execResult, message.command || 'unknown')

            if (config.enableDuplicateCommits) {
                for (const intent of execResult.intents) {
                    if (this.commitRegistry.isCommitted(intent.id)) {
                        result.duplicateCommitsAttempted++
                        result.duplicateCommitsSucceeded++
                    }
                }
            }

        } catch (error) {
            result.failedExecutions++
            result.invariantViolations.push(`Execution ${this.executionCounter}: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    private recordExecution(execResult: ExecutionResult, command: string): void {
        const record: ExecutionRecord = {
            executionId: execResult.executionId,
            transactionId: execResult.transactionId,
            command,
            phase: execResult.phase,
            finalStateHash: execResult.finalStateHash,
            transitions: execResult.transitions.map(t => `${t.from}->${t.to}`),
            intents: execResult.intents.map(i => `${i.type}:${i.targetJid}`),
            commitDecision: execResult.commitDecision,
            timestamp: Date.now(),
            stateSnapshotHash: execResult.stateSnapshotHash
        }
        this.records.push(record)
    }

    private checkDeterminism(): number {
        const hashGroups = new Map<string, number>()
        for (const record of this.records) {
            const count = hashGroups.get(record.finalStateHash) || 0
            hashGroups.set(record.finalStateHash, count + 1)
        }

        let divergence = 0
        for (const [hash, count] of hashGroups) {
            if (count > 1) {
                divergence += count - 1
            }
        }

        return divergence
    }

    getRecords(): readonly ExecutionRecord[] {
        return [...this.records]
    }

    getCommitRegistryState(): {
        reserved: number
        committed: number
        failed: number
    } {
        const reservations = this.commitRegistry.getAllReservations()
        let reserved = 0, committed = 0, failed = 0
        for (const r of reservations) {
            if (r.state === CommitState.RESERVED) reserved++
            else if (r.state === CommitState.COMMITTED) committed++
            else if (r.state === CommitState.FAILED) failed++
        }
        return { reserved, committed, failed }
    }
}

export class ConcurrentExecutionSimulator {
    private activeCount = 0
    private maxConcurrent = 0

    async simulate(
        tasks: Array<() => Promise<unknown>>,
        maxParallel: number = 10
    ): Promise<unknown[]> {
        this.activeCount = 0
        this.maxConcurrent = 0

        const batches: Array<Array<() => Promise<unknown>>> = []
        for (let i = 0; i < tasks.length; i += maxParallel) {
            batches.push(tasks.slice(i, i + maxParallel))
        }

        const results: unknown[] = []

        for (const batch of batches) {
            const batchResults = await Promise.all(batch.map(async (task) => {
                this.activeCount++
                this.maxConcurrent = Math.max(this.maxConcurrent, this.activeCount)
                try {
                    return await task()
                } finally {
                    this.activeCount--
                }
            }))
            results.push(...batchResults)
        }

        return results
    }

    getMaxConcurrent(): number {
        return this.maxConcurrent
    }

getActiveCount(): number {
        return this.activeCount
    }
}

export interface ReplaySession {
    id: string
    originalExecution: ExecutionRecord
    replayExecution?: ExecutionRecord
    diverged: boolean
    divergenceDetails: string[]
}

export class ReplayConsistencySuite {
    private sessions: ReplaySession[] = []

    addSession(id: string, original: ExecutionRecord): void {
        this.sessions.push({
            id,
            originalExecution: original,
            diverged: false,
            divergenceDetails: []
        })
    }

    addReplay(id: string, replay: ExecutionRecord): { diverged: boolean; details: string[] } {
        const session = this.sessions.find(s => s.id === id)
        if (!session) {
            return { diverged: true, details: ['No original session found'] }
        }

        session.replayExecution = replay
        const details: string[] = []

        if (session.originalExecution.finalStateHash !== replay.finalStateHash) {
            details.push(`State hash mismatch: original=${session.originalExecution.finalStateHash}, replay=${replay.finalStateHash}`)
            session.diverged = true
        }

        if (session.originalExecution.transitions.join('|') !== replay.transitions.join('|')) {
            details.push(`Transitions mismatch: original=${session.originalExecution.transitions.join('|')}, replay=${replay.transitions.join('|')}`)
            session.diverged = true
        }

        if (session.originalExecution.commitDecision !== replay.commitDecision) {
            details.push(`Commit decision mismatch: original=${session.originalExecution.commitDecision}, replay=${replay.commitDecision}`)
            session.diverged = true
        }

        if (session.originalExecution.intents.join('|') !== replay.intents.join('|')) {
            details.push(`Intents mismatch: original=${session.originalExecution.intents.join('|')}, replay=${replay.intents.join('|')}`)
            session.diverged = true
        }

        session.divergenceDetails = details
        return { diverged: session.diverged, details }
    }

    getSessions(): readonly ReplaySession[] {
        return [...this.sessions]
    }

    getDivergenceCount(): number {
        return this.sessions.filter(s => s.diverged).length
    }

    reset(): void {
        this.sessions = []
    }
}

export function createMockMessage(command: string, args: string[] = []): NormalizedMessage {
    const msgId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return {
        id: msgId,
        command,
        args,
        senderJid: 'test@jid',
        chatJid: 'testgroup@jid',
        chatType: 'group' as const,
        type: 'text' as const,
        content: null,
        caption: null,
        quoted: null,
        mentioned: [],
        urls: [],
        commandPrefix: '!',
        timestamp: Date.now(),
        pushName: 'TestUser',
        isFromMe: false,
        sender: { jid: 'test@jid', username: 'TestUser', isAdmin: false },
        groupRef: (() => null) as any,
        transportRef: { messageId: msgId, chatJid: 'testgroup@jid', senderJid: 'test@jid' },
        media: (() => null) as any
    }
}

export function createMockDescriptor(name: string, executeFn: () => Promise<{ success: boolean }>): CommandDescriptor {
    return {
        capabilities: {
            canonical: name,
            aliases: [],
            permissions: { ownerOnly: false, adminOnly: false, sudoOnly: false, selfOnly: false, privateOnly: false, groupOnly: false },
            cooldown: { scope: 'user', durationMs: 0, bypassOwner: false, bypassAdmin: false },
            flags: { disabled: false, maintenance: false, nsfw: false },
            transport: { allowQuoted: true, allowMedia: false, allowEdits: false }
        },
        execute: async (message, args, ctx) => {
            return await executeFn()
        }
    }
}