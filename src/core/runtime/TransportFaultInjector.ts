import { CommitState, type CommitReservation, type AuthoritativeCommitRegistry } from '../transport/AuthoritativeCommitRegistry.js'
import type { TransportIntent } from '../transport/types.js'

export enum FaultType {
    PARTIAL_COMMIT = 'PARTIAL_COMMIT',
    DUPLICATE_SEND = 'DUPLICATE_SEND',
    TIMEOUT = 'TIMEOUT',
    CRASH_AFTER_RESERVATION = 'CRASH_AFTER_RESERVATION',
    RETRY_AFTER_FINALIZE = 'RETRY_AFTER_FINALIZE',
    DELAYED_COMMIT = 'DELAYED_COMMIT',
    INTENT_DUPLICATION = 'INTENT_DUPLICATION',
    TRANSACTION_MIXUP = 'TRANSACTION_MIXUP'
}

export interface FaultInjectionConfig {
    enabledFaults: Set<FaultType>
    failureRate: number
    delayMs: number
}

export interface FaultOutcome {
    faultType: FaultType | null
    intentId: string
    success: boolean
    error?: string
    commitState?: CommitState
    retrySafe: boolean
}

export class TransportFaultInjector {
    private config: FaultInjectionConfig
    private injectedFaults: FaultOutcome[] = []
    private commitAttempts = new Map<string, number>()
    private lastCommittedState: Map<string, CommitState> = new Map()

    constructor(config?: Partial<FaultInjectionConfig>) {
        this.config = {
            enabledFaults: config?.enabledFaults || new Set(),
            failureRate: config?.failureRate ?? 0.0,
            delayMs: config?.delayMs ?? 0
        }
        this.injectedFaults = []
    }

    enableFault(type: FaultType): void {
        this.config.enabledFaults.add(type)
    }

    disableFault(type: FaultType): void {
        this.config.enabledFaults.delete(type)
    }

    setFailureRate(rate: number): void {
        this.config.failureRate = Math.max(0, Math.min(1, rate))
    }

    setDelay(ms: number): void {
        this.config.delayMs = Math.max(0, ms)
    }

    async injectFault(
        intent: TransportIntent,
        registry: AuthoritativeCommitRegistry
    ): Promise<FaultOutcome> {
        const shouldInject = Math.random() < this.config.failureRate

        if (!shouldInject && this.config.enabledFaults.size === 0) {
            return {
                faultType: null,
                intentId: intent.id,
                success: true,
                retrySafe: true
            }
        }

        const faultType = this.selectFaultType()

        if (this.config.delayMs > 0) {
            await this.delay(this.config.delayMs)
        }

        const outcome = this.executeFault(faultType, intent, registry)
        this.injectedFaults.push(outcome)

        return outcome
    }

    private selectFaultType(): FaultType | null {
        if (this.config.enabledFaults.size === 0) {
            return null
        }

        const faultTypes = [...this.config.enabledFaults]
        return faultTypes[Math.floor(Math.random() * faultTypes.length)]
    }

    private executeFault(
        faultType: FaultType | null,
        intent: TransportIntent,
        registry: AuthoritativeCommitRegistry
    ): FaultOutcome {
        switch (faultType) {
            case FaultType.PARTIAL_COMMIT:
                return this.injectPartialCommit(intent, registry)

            case FaultType.DUPLICATE_SEND:
                return this.injectDuplicateSend(intent, registry)

            case FaultType.TIMEOUT:
                return this.injectTimeout(intent, registry)

            case FaultType.CRASH_AFTER_RESERVATION:
                return this.injectCrashAfterReservation(intent, registry)

            case FaultType.RETRY_AFTER_FINALIZE:
                return this.injectRetryAfterFinalize(intent, registry)

            case FaultType.DELAYED_COMMIT:
                return this.injectDelayedCommit(intent, registry)

            case FaultType.INTENT_DUPLICATION:
                return this.injectIntentDuplication(intent, registry)

            case FaultType.TRANSACTION_MIXUP:
                return this.injectTransactionMixup(intent, registry)

            default:
                return {
                    faultType: null,
                    intentId: intent.id,
                    success: true,
                    retrySafe: true
                }
        }
    }

    private injectPartialCommit(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        const attemptCount = (this.commitAttempts.get(intent.id) || 0) + 1
        this.commitAttempts.set(intent.id, attemptCount)

        if (attemptCount === 1) {
            registry.markFailed(intent.id, new Error('Partial commit failure (first attempt)'))
            return {
                faultType: FaultType.PARTIAL_COMMIT,
                intentId: intent.id,
                success: false,
                error: 'First attempt failed intentionally',
                commitState: CommitState.FAILED,
                retrySafe: true
            }
        }

        registry.markCommitted(intent.id, Date.now())
        return {
            faultType: FaultType.PARTIAL_COMMIT,
            intentId: intent.id,
            success: true,
            commitState: CommitState.COMMITTED,
            retrySafe: true
        }
    }

    private injectDuplicateSend(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        const alreadyCommitted = registry.isCommitted(intent.id)

        if (alreadyCommitted) {
            const prevState = this.lastCommittedState.get(intent.id)

            if (prevState === CommitState.COMMITTED) {
                return {
                    faultType: FaultType.DUPLICATE_SEND,
                    intentId: intent.id,
                    success: true,
                    commitState: CommitState.COMMITTED,
                    retrySafe: false,
                    error: 'Duplicate send detected but idempotent - already committed'
                }
            }

            return {
                faultType: FaultType.DUPLICATE_SEND,
                intentId: intent.id,
                success: false,
                error: 'Duplicate send attempt blocked',
                retrySafe: false
            }
        }

        registry.markCommitted(intent.id, Date.now())
        this.lastCommittedState.set(intent.id, CommitState.COMMITTED)

        return {
            faultType: FaultType.DUPLICATE_SEND,
            intentId: intent.id,
            success: true,
            commitState: CommitState.COMMITTED,
            retrySafe: true
        }
    }

    private injectTimeout(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        registry.markFailed(intent.id, new Error('Commit timeout'))

        return {
            faultType: FaultType.TIMEOUT,
            intentId: intent.id,
            success: false,
            error: 'Transport timeout',
            commitState: CommitState.FAILED,
            retrySafe: true
        }
    }

    private injectCrashAfterReservation(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        registry.reserve(intent.id, 'crash-test-txn', Date.now())

        return {
            faultType: FaultType.CRASH_AFTER_RESERVATION,
            intentId: intent.id,
            success: false,
            error: 'Transport crashed after reservation',
            commitState: CommitState.RESERVED,
            retrySafe: false
        }
    }

    private injectRetryAfterFinalize(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        const wasCommitted = registry.isCommitted(intent.id)

        if (wasCommitted) {
            return {
                faultType: FaultType.RETRY_AFTER_FINALIZE,
                intentId: intent.id,
                success: true,
                commitState: CommitState.COMMITTED,
                retrySafe: true,
                error: 'Retry blocked - already committed (idempotent)'
            }
        }

        registry.markCommitted(intent.id, Date.now())
        return {
            faultType: FaultType.RETRY_AFTER_FINALIZE,
            intentId: intent.id,
            success: true,
            commitState: CommitState.COMMITTED,
            retrySafe: true
        }
    }

    private injectDelayedCommit(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        registry.markCommitted(intent.id, Date.now())

        return {
            faultType: FaultType.DELAYED_COMMIT,
            intentId: intent.id,
            success: true,
            commitState: CommitState.COMMITTED,
            retrySafe: true
        }
    }

    private injectIntentDuplication(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        const duplicateId = `${intent.id}-dup-${Date.now()}`
        const existing = registry.getReservation(intent.id)

        if (existing) {
            return {
                faultType: FaultType.INTENT_DUPLICATION,
                intentId: intent.id,
                success: true,
                commitState: existing.state,
                retrySafe: true,
                error: `Intent already exists - deduplicated to ${intent.id}`
            }
        }

        registry.reserve(intent.id, 'dup-test-txn', Date.now())
        registry.markCommitted(intent.id, Date.now())

        return {
            faultType: FaultType.INTENT_DUPLICATION,
            intentId: intent.id,
            success: true,
            commitState: CommitState.COMMITTED,
            retrySafe: true
        }
    }

    private injectTransactionMixup(intent: TransportIntent, registry: AuthoritativeCommitRegistry): FaultOutcome {
        const reserved = registry.reserve(intent.id, 'wrong-txn-id', Date.now())
        if (!reserved) {
            return {
                faultType: FaultType.TRANSACTION_MIXUP,
                intentId: intent.id,
                success: false,
                error: 'Could not reserve with wrong transaction ID',
                retrySafe: true
            }
        }

        registry.markCommitted(intent.id, Date.now())

        return {
            faultType: FaultType.TRANSACTION_MIXUP,
            intentId: intent.id,
            success: true,
            commitState: CommitState.COMMITTED,
            retrySafe: true,
            error: 'Reserved with wrong transaction ID but committed'
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    getInjectedFaults(): readonly FaultOutcome[] {
        return [...this.injectedFaults]
    }

    getFaultCount(): number {
        return this.injectedFaults.filter(f => f.faultType !== null).length
    }

    getRetryUnsafeCount(): number {
        return this.injectedFaults.filter(f => !f.retrySafe).length
    }

    reset(): void {
        this.injectedFaults = []
        this.commitAttempts.clear()
        this.lastCommittedState.clear()
    }

    verifyIdempotency(registry: AuthoritativeCommitRegistry): {
        idempotent: boolean
        duplicateSendsBlocked: number
        retriesSucceeded: number
        issues: string[]
    } {
        const issues: string[] = []
        let duplicateSendsBlocked = 0
        let retriesSucceeded = 0

        for (const fault of this.injectedFaults) {
            if (fault.faultType === FaultType.DUPLICATE_SEND && !fault.retrySafe) {
                duplicateSendsBlocked++
                issues.push(`Duplicate send not blocked for ${fault.intentId}`)
            }

            if (fault.retrySafe) {
                retriesSucceeded++
            }
        }

        return {
            idempotent: issues.length === 0,
            duplicateSendsBlocked,
            retriesSucceeded,
            issues
        }
    }
}