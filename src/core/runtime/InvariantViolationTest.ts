import type { ExecutionTransaction } from '../transport/TransportFacade.js'
import type { AuthoritativeCommitRegistry } from '../transport/AuthoritativeCommitRegistry.js'
import type { StateSnapshot } from '../state/index.js'
import { CommitState } from '../transport/AuthoritativeCommitRegistry.js'

export enum InvariantViolationType {
    DOUBLE_FINALIZE = 'DOUBLE_FINALIZE',
    APPEND_AFTER_FINALIZE = 'APPEND_AFTER_FINALIZE',
    DUPLICATE_INTENT_ID = 'DUPLICATE_INTENT_ID',
    DUPLICATE_TRANSACTION_ID = 'DUPLICATE_TRANSACTION_ID',
    NON_MONOTONIC_REVISION = 'NON_MONOTONIC_REVISION',
    OUT_OF_ORDER_TRANSITION = 'OUT_OF_ORDER_TRANSITION',
    CONCURRENT_COMMIT_MUTATION = 'CONCURRENT_COMMIT_MUTATION',
    INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION'
}

export interface InvariantViolationResult {
    type: InvariantViolationType
    caught: boolean
    errorMessage?: string
    stackTrace?: string
    safeAbort: boolean
}

export class InvariantViolationTest {
    private testResults: InvariantViolationResult[] = []

    testDoubleFinalize(transaction: ExecutionTransaction): InvariantViolationResult {
        const result: InvariantViolationResult = {
            type: InvariantViolationType.DOUBLE_FINALIZE,
            caught: false,
            safeAbort: false
        }

        try {
            transaction.finalize(1)

            try {
                transaction.finalize(2)
                result.errorMessage = 'Second finalize did not throw'
            } catch (e) {
                result.caught = true
                result.errorMessage = e instanceof Error ? e.message : String(e)
                result.safeAbort = e instanceof Error && e.message.includes('already finalized')
            }
        } catch (e) {
            result.errorMessage = e instanceof Error ? e.message : String(e)
            result.safeAbort = false
        }

        this.testResults.push(result)
        return result
    }

    testAppendAfterFinalize(transaction: ExecutionTransaction): InvariantViolationResult {
        const result: InvariantViolationResult = {
            type: InvariantViolationType.APPEND_AFTER_FINALIZE,
            caught: false,
            safeAbort: false
        }

        try {
            transaction.finalize(1)

            const fakeIntent = {
                id: 'test-intent-1',
                type: 'SEND_TEXT' as const,
                targetJid: 'test@jid',
                sequence: 1,
                payload: { text: 'test' },
                createdAtTick: 1
            }

            try {
                transaction.appendIntent(fakeIntent as any)
                result.errorMessage = 'appendIntent after finalize did not throw'
            } catch (e) {
                result.caught = true
                result.errorMessage = e instanceof Error ? e.message : String(e)
                result.safeAbort = e instanceof Error && e.message.includes('finalized')
            }
        } catch (e) {
            result.errorMessage = e instanceof Error ? e.message : String(e)
            result.safeAbort = false
        }

        this.testResults.push(result)
        return result
    }

    testDuplicateIntentId(registry: AuthoritativeCommitRegistry): InvariantViolationResult {
        const result: InvariantViolationResult = {
            type: InvariantViolationType.DUPLICATE_INTENT_ID,
            caught: false,
            safeAbort: false
        }

        const intentId = 'dup-intent-123'
        const txnId = 'txn-123'

        try {
            const r1 = registry.reserve(intentId, txnId, 1)
            const r2 = registry.reserve(intentId, txnId, 2)

            if (r1 && r2) {
                if (r1 === r2 || r2.state === CommitState.RESERVED) {
                    result.caught = true
                    result.safeAbort = true
                    result.errorMessage = 'Duplicate reservation returned same object (idempotent)'
                } else {
                    result.errorMessage = 'Second reservation succeeded unexpectedly'
                }
            } else if (!r2) {
                result.caught = true
                result.safeAbort = true
                result.errorMessage = 'Duplicate reservation correctly rejected'
            }
        } catch (e) {
            result.errorMessage = e instanceof Error ? e.message : String(e)
            result.safeAbort = false
        }

        this.testResults.push(result)
        return result
    }

    testDuplicateTransactionId(registry: AuthoritativeCommitRegistry): InvariantViolationResult {
        const result: InvariantViolationResult = {
            type: InvariantViolationType.DUPLICATE_TRANSACTION_ID,
            caught: false,
            safeAbort: false
        }

        const intentId1 = 'intent-1'
        const intentId2 = 'intent-2'
        const txnId = 'dup-txn-456'

        try {
            registry.reserve(intentId1, txnId, 1)
            registry.reserve(intentId2, txnId, 2)

            const isCommitted1 = registry.isCommitted(intentId1)
            const isCommitted2 = registry.isCommitted(intentId2)

            if (!isCommitted1 && !isCommitted2) {
                result.caught = true
                result.safeAbort = true
                result.errorMessage = 'Duplicate transaction IDs handled correctly - no commits'
            } else {
                result.errorMessage = 'Transaction handling unclear for duplicate IDs'
            }
        } catch (e) {
            result.errorMessage = e instanceof Error ? e.message : String(e)
            result.safeAbort = false
        }

        this.testResults.push(result)
        return result
    }

    testNonMonotonicRevision(snapshots: StateSnapshot[]): InvariantViolationResult {
        const result: InvariantViolationResult = {
            type: InvariantViolationType.NON_MONOTONIC_REVISION,
            caught: false,
            safeAbort: false
        }

        try {
            let lastRevision = 0

            for (const snap of snapshots) {
                if (snap.revision <= lastRevision) {
                    result.caught = true
                    result.safeAbort = true
                    result.errorMessage = 'Non-monotonic revision: ' + lastRevision + ' -> ' + snap.revision
                    break
                }
                lastRevision = snap.revision
            }

            if (!result.caught) {
                result.caught = true
                result.safeAbort = true
                result.errorMessage = 'All revisions were monotonic'
            }
        } catch (e) {
            result.errorMessage = e instanceof Error ? e.message : String(e)
            result.safeAbort = false
        }

        this.testResults.push(result)
        return result
    }

    testOutOfOrderTransitions(
        transitions: Array<{ from: string; to: string; tick: number }>
    ): InvariantViolationResult {
        const result: InvariantViolationResult = {
            type: InvariantViolationType.OUT_OF_ORDER_TRANSITION,
            caught: false,
            safeAbort: false
        }

        try {
            for (let i = 1; i < transitions.length; i++) {
                if (transitions[i].tick < transitions[i - 1].tick) {
                    result.caught = true
                    result.safeAbort = true
                    result.errorMessage = 'Out-of-order tick at index ' + i + ': ' + transitions[i - 1].tick + ' -> ' + transitions[i].tick
                    break
                }
            }

            for (let i = 0; i < transitions.length - 1; i++) {
                if (transitions[i].to !== transitions[i + 1].from) {
                    result.caught = true
                    result.safeAbort = true
                    result.errorMessage = 'Transition gap at index ' + i + ': ' + transitions[i].to + ' -> ' + transitions[i + 1].from
                    break
                }
            }

            if (!result.caught) {
                result.caught = true
                result.safeAbort = true
                result.errorMessage = 'All transitions were properly ordered'
            }
        } catch (e) {
            result.errorMessage = e instanceof Error ? e.message : String(e)
            result.safeAbort = false
        }

        this.testResults.push(result)
        return result
    }

    testConcurrentCommitMutation(
        registry: AuthoritativeCommitRegistry,
        intentId: string
    ): InvariantViolationResult {
        const result: InvariantViolationResult = {
            type: InvariantViolationType.CONCURRENT_COMMIT_MUTATION,
            caught: false,
            safeAbort: false
        }

        try {
            const reserved = registry.reserve(intentId, 'txn-concurrent', 1)
            if (!reserved) {
                result.errorMessage = 'Could not reserve intent'
                this.testResults.push(result)
                return result
            }

            const committed1 = registry.markCommitted(intentId, 2)
            const committed2 = registry.markCommitted(intentId, 3)

            if (committed1 && committed2) {
                result.caught = true
                result.safeAbort = true
                result.errorMessage = 'Concurrent mutations handled idempotently'
            } else if (!committed2) {
                result.caught = true
                result.safeAbort = true
                result.errorMessage = 'Second commit correctly rejected'
            }
        } catch (e) {
            result.errorMessage = e instanceof Error ? e.message : String(e)
            result.safeAbort = false
        }

        this.testResults.push(result)
        return result
    }

    runAllTests(
        transaction: ExecutionTransaction,
        registry: AuthoritativeCommitRegistry,
        snapshots: StateSnapshot[],
        transitions: Array<{ from: string; to: string; tick: number }>
    ): { passed: number; failed: number; results: InvariantViolationResult[] } {
        const results: InvariantViolationResult[] = []

        results.push(this.testDoubleFinalize(transaction))
        results.push(this.testAppendAfterFinalize(transaction))
        results.push(this.testDuplicateIntentId(registry))
        results.push(this.testDuplicateTransactionId(registry))
        results.push(this.testNonMonotonicRevision(snapshots))
        results.push(this.testOutOfOrderTransitions(transitions))
        results.push(this.testConcurrentCommitMutation(registry, 'test-concurrent-intent'))

        return {
            passed: results.filter(r => r.caught && r.safeAbort).length,
            failed: results.filter(r => !r.caught || !r.safeAbort).length,
            results
        }
    }

    getResults(): InvariantViolationResult[] {
        return [...this.testResults]
    }

    reset(): void {
        this.testResults = []
    }
}