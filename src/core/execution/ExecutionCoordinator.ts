import type RuntimeClient from '../RuntimeClient.js'
import type { NormalizedMessage } from '../serializer/types.js'
import type { ParsedArgs, MiddlewareMetadata, InternalMiddlewareContext } from '../middleware/types.js'
import { MapMiddlewareMetadata, MiddlewarePhase, createInternalMiddlewareContext } from '../middleware/types.js'
import type { CommandDescriptor, CommandCapabilities } from '../dispatcher/types.js'
import { createTransaction, createTransportFacade, type ExecutionTransaction } from '../transport/index.js'
import { CommitDecision, type TransportIntent, type TransportCapabilities, type ExecutionContext } from '../transport/types.js'
import { ExecutionClock, createLiveClock, ExecutionMode } from './ExecutionClock.js'
import { createExecutionSequenceDomain, type ExecutionSequenceDomain, freezeDeep } from './ExecutionSequenceDomain.js'
import { AuthoritativeCommitRegistry } from '../transport/AuthoritativeCommitRegistry.js'
import type { IMiddlewareChain } from '../middleware/index.js'
import type { StateSnapshot } from '../state/index.js'

export enum ExecutionPhase {
    CREATED = 'CREATED',
    EXECUTING = 'EXECUTING',
    PRE_COMMIT = 'PRE_COMMIT',
    COMMITTING = 'COMMITTING',
    POST_COMMIT = 'POST_COMMIT',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    ABORTED = 'ABORTED'
}

export interface ExecutionTransition {
    readonly from: ExecutionPhase
    readonly to: ExecutionPhase
    readonly tick: number
}

export interface TransactionSnapshot {
    readonly id: string
    readonly sequence: number
    readonly intents: readonly TransportIntent[]
    readonly createdAtTick: number
    readonly stateSnapshot?: StateSnapshot
}

export interface ExecutionResult {
    readonly success: boolean
    readonly executionId: string
    readonly transactionId: string
    readonly phase: ExecutionPhase
    readonly intents: readonly TransportIntent[]
    readonly commitDecision: CommitDecision
    readonly durationMs: number
    readonly finalizedTick: number
    readonly finalStateHash: string
    readonly transitions: readonly ExecutionTransition[]
    readonly stateSnapshotHash?: string
    readonly error?: Error
}

export interface ExecutionLifecycleCallbacks {
    onPreCommit?: (transaction: ExecutionTransaction) => Promise<{ decision: CommitDecision; denialReason?: string }>
    onCommit?: (transaction: ExecutionTransaction, intents: readonly TransportIntent[]) => Promise<boolean>
    onPostCommit?: (transaction: ExecutionTransaction, success: boolean) => Promise<void>
}

function validateTransitions(
    transitions: readonly ExecutionTransition[],
    startPhase: ExecutionPhase,
    endPhase: ExecutionPhase
): void {
    if (transitions.length === 0) {
        throw new Error('No transitions recorded')
    }
    if (transitions[0].from !== startPhase) {
        throw new Error(`First transition must start from ${startPhase}`)
    }
    const lastTransition = transitions[transitions.length - 1]
    if (lastTransition.to !== endPhase) {
        throw new Error(`Last transition must end at ${endPhase}`)
    }
    for (let i = 0; i < transitions.length - 1; i++) {
        if (transitions[i].to !== transitions[i + 1].from) {
            throw new Error(`Transition gap at index ${i}: ${transitions[i].to} -> ${transitions[i + 1].from}`)
        }
        if (transitions[i + 1].tick < transitions[i].tick) {
            throw new Error(`Non-monotonic tick at index ${i + 1}`)
        }
    }
}

function validateNoDoubleFinalization(phase: ExecutionPhase): void {
    if (phase === ExecutionPhase.COMPLETED || phase === ExecutionPhase.ABORTED || phase === ExecutionPhase.FAILED) {
    }
}

const VALID_TRANSITIONS: Record<ExecutionPhase, ExecutionPhase[]> = {
    [ExecutionPhase.CREATED]: [ExecutionPhase.EXECUTING],
    [ExecutionPhase.EXECUTING]: [ExecutionPhase.PRE_COMMIT, ExecutionPhase.FAILED],
    [ExecutionPhase.PRE_COMMIT]: [ExecutionPhase.COMMITTING, ExecutionPhase.ABORTED, ExecutionPhase.FAILED],
    [ExecutionPhase.COMMITTING]: [ExecutionPhase.POST_COMMIT, ExecutionPhase.FAILED],
    [ExecutionPhase.POST_COMMIT]: [ExecutionPhase.COMPLETED, ExecutionPhase.FAILED],
    [ExecutionPhase.COMPLETED]: [],
    [ExecutionPhase.FAILED]: [],
    [ExecutionPhase.ABORTED]: []
}

function computeStateHash(
    executionSequence: number,
    transactionSequence: number,
    transitions: readonly ExecutionTransition[],
    intents: readonly TransportIntent[],
    decision: CommitDecision
): string {
    const data = JSON.stringify({
        execSeq: executionSequence,
        txnSeq: transactionSequence,
        transitionCount: transitions.length,
        transitionSequence: transitions.map(t => `${t.from}->${t.to}`).join('|'),
        intents: intents.map(i => `${i.type}:${i.targetJid}:${i.sequence}`),
        decision,
        totalIntents: intents.length
    })
    let hash = 0
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
    }
    return Math.abs(hash).toString(36)
}

export interface ExecutionCoordinatorConfig {
    readonly capabilities: TransportCapabilities
    readonly maxRetries?: number
    readonly timeoutMs?: number
    readonly lifecycleCallbacks?: ExecutionLifecycleCallbacks
    readonly clock?: ExecutionClock
    readonly middlewareChain?: IMiddlewareChain
    readonly enableMiddlewareCommitPhases?: boolean
}

export class ExecutionCoordinator {
    private readonly client: RuntimeClient
    private readonly config: ExecutionCoordinatorConfig
    private readonly commitRegistry: AuthoritativeCommitRegistry
    private executionSequence = 0
    private transactionSequence = 0
    private isExecuting = false
    private readonly executionLock = new Map<string, Promise<void>>()
    private readonly activeTransactions = new Set<string>()

    constructor(client: RuntimeClient, config: ExecutionCoordinatorConfig) {
        this.client = client
        this.config = config
        this.commitRegistry = new AuthoritativeCommitRegistry()
        if (config.clock) {
            this.commitRegistry.setExecutionMode(config.clock.getMode())
        }
    }

    reset(): void {
        this.executionSequence = 0
        this.transactionSequence = 0
        this.isExecuting = false
        this.activeTransactions.clear()
        this.commitRegistry.clear()
    }

    private claimTransaction(transactionId: string): boolean {
        if (this.activeTransactions.has(transactionId)) {
            return false
        }
        this.activeTransactions.add(transactionId)
        return true
    }

    private releaseTransaction(transactionId: string): void {
        this.activeTransactions.delete(transactionId)
    }

    private async executeMiddlewarePhase(
        phase: MiddlewarePhase,
        context: InternalMiddlewareContext
    ): Promise<boolean> {
        if (!this.config.middlewareChain) {
            return true
        }

        const middlewareInPhase = this.config.middlewareChain.getMiddleware()
            .filter(m => m.phase === phase)

        if (middlewareInPhase.length === 0) {
            return true
        }

        try {
            const status = await this.config.middlewareChain.execute(context)
            return status.state === 'completed'
        } catch {
            return false
        }
    }

    private createDomain(executionId: string, transactionId: string): ExecutionSequenceDomain {
        return createExecutionSequenceDomain(executionId, transactionId)
    }

    private transition(from: ExecutionPhase, to: ExecutionPhase, clock: ExecutionClock): ExecutionTransition {
        const valid = VALID_TRANSITIONS[from]
        if (!valid.includes(to)) {
            throw new Error(`Invalid phase transition: ${from} -> ${to}`)
        }
        return { from, to, tick: clock.getTick() }
    }

    private createSnapshot(txn: ExecutionTransaction, tick: number): TransactionSnapshot {
        return Object.freeze({
            id: txn.id,
            sequence: txn.sequence,
            intents: Object.freeze([...txn.transportIntents]),
            createdAtTick: tick
        })
    }

    async execute(
        descriptor: CommandDescriptor,
        message: NormalizedMessage,
        args: ParsedArgs
    ): Promise<ExecutionResult> {
        const clock = this.config.clock ?? createLiveClock()
        
        const executionSeq = ++this.executionSequence
        const transactionSeq = ++this.transactionSequence
        const executionId = `exec-${executionSeq}`
        const transactionId = `txn-${transactionSeq}`

        if (!this.claimTransaction(transactionId)) {
            return {
                success: false,
                executionId,
                transactionId,
                phase: ExecutionPhase.FAILED,
                intents: [],
                commitDecision: CommitDecision.DENY,
                durationMs: 0,
                finalizedTick: 0,
                finalStateHash: '',
                transitions: [],
                error: new Error('Concurrent execution on same transaction blocked')
            }
        }

        this.isExecuting = true
        
        const domain = this.createDomain(executionId, transactionId)
        
        const startTick = domain.getTick()
        const transitions: ExecutionTransition[] = []
        let phase = ExecutionPhase.CREATED

        try {
            domain.tick()
            const executingTick = domain.getTick()
            transitions.push(this.transition(phase, ExecutionPhase.EXECUTING, clock))
            phase = ExecutionPhase.EXECUTING

            const transaction = createTransaction(transactionId, undefined, executingTick)
            const snapshots: TransactionSnapshot[] = [this.createSnapshot(transaction, executingTick)]

            const transport = createTransportFacade(
                undefined,
                transaction,
                domain.nextIntentSequence.bind(domain)
            )

            const execContext = freezeDeep({
                message,
                executionId,
                startTime: executingTick,
                transport,
                capabilities: this.config.capabilities,
                metadata: new MapMiddlewareMetadata(),
                transaction
            })

            await descriptor.execute(message, args, execContext as ExecutionContext)

            const finalTransaction = transaction
            const postExecTick = domain.getTick()
            snapshots.push(this.createSnapshot(finalTransaction, postExecTick))

            domain.tick()
            const preCommitTick = domain.getTick()
            transitions.push(this.transition(phase, ExecutionPhase.PRE_COMMIT, clock))
            phase = ExecutionPhase.PRE_COMMIT

            let preCommitResult: { decision: CommitDecision; denialReason?: string } = { decision: CommitDecision.ALLOW, denialReason: undefined }

            if (this.config.lifecycleCallbacks?.onPreCommit) {
                preCommitResult = await this.config.lifecycleCallbacks.onPreCommit(finalTransaction)
            }

            if (preCommitResult.decision === CommitDecision.ALLOW) {
                domain.tick()
                const committingTick = domain.getTick()
                transitions.push(this.transition(phase, ExecutionPhase.COMMITTING, clock))
                phase = ExecutionPhase.COMMITTING

                let commitSuccess = false
                if (this.config.lifecycleCallbacks?.onCommit) {
                    if (!clock.canSendTransport()) {
                        commitSuccess = true
                    } else {
                        for (const intent of finalTransaction.transportIntents) {
                            if (this.commitRegistry.isCommitted(intent.id)) {
                                continue
                            }
                            const reserved = this.commitRegistry.reserve(
                                intent.id,
                                finalTransaction.id,
                                domain.getTick()
                            )
                            if (!reserved) {
                                continue
                            }
                        }
                        commitSuccess = await this.config.lifecycleCallbacks.onCommit(
                            finalTransaction,
                            finalTransaction.transportIntents
                        )
                        if (commitSuccess) {
                            for (const intent of finalTransaction.transportIntents) {
                                this.commitRegistry.markCommitted(intent.id, domain.getTick())
                            }
                        }
                    }
                }

                domain.tick()
                transitions.push(this.transition(phase, ExecutionPhase.POST_COMMIT, clock))
                phase = ExecutionPhase.POST_COMMIT

                if (this.config.lifecycleCallbacks?.onPostCommit) {
                    await this.config.lifecycleCallbacks.onPostCommit(finalTransaction, commitSuccess)
                }
            }

            const endPhase = preCommitResult.decision === CommitDecision.ALLOW
                ? ExecutionPhase.COMPLETED
                : ExecutionPhase.ABORTED
            domain.tick()
            transitions.push(this.transition(phase, endPhase, clock))
            phase = endPhase

            validateTransitions(transitions, ExecutionPhase.CREATED, endPhase)
            if (endPhase === ExecutionPhase.COMPLETED) {
                validateNoDoubleFinalization(phase)
            }

            const endTick = domain.getTick()
            const durationTicks = endTick - startTick
            const finalStateHash = computeStateHash(
                executionSeq,
                transactionSeq,
                transitions,
                finalTransaction.transportIntents,
                preCommitResult.decision
            )

            const result = {
                success: preCommitResult.decision === CommitDecision.ALLOW,
                executionId,
                transactionId: finalTransaction.id,
                phase,
                intents: freezeDeep([...finalTransaction.transportIntents]),
                commitDecision: preCommitResult.decision,
                durationMs: durationTicks,
                finalizedTick: endTick,
                finalStateHash,
                transitions: freezeDeep([...transitions])
            }

            this.isExecuting = false
            this.releaseTransaction(transactionId)
            return freezeDeep(result)
        } catch (error) {
            domain.tick()
            transitions.push(this.transition(phase, ExecutionPhase.FAILED, clock))
            const endTick = domain.getTick()
            const durationTicks = endTick - startTick
            const finalStateHash = computeStateHash(
                executionSeq,
                0,
                transitions,
                [],
                CommitDecision.DENY
            )

            const errorResult = {
                success: false,
                executionId,
                transactionId: '',
                phase: ExecutionPhase.FAILED,
                intents: [],
                commitDecision: CommitDecision.DENY,
                durationMs: durationTicks,
                finalizedTick: endTick,
                finalStateHash,
                transitions: freezeDeep([...transitions]),
                error: error instanceof Error ? error : new Error(String(error))
            }

            this.isExecuting = false
            this.releaseTransaction(transactionId)
            return freezeDeep(errorResult)
        }
    }
}