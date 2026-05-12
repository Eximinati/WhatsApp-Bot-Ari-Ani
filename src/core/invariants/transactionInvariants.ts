import { invariant, assertString, assertPositive, assertMonotonic } from './invariant.js'
import type { TransportIntent, ExecutionTransaction } from '../transport/types.js'

export function validateTransactionId(id: string): void {
    assertString(id, 'INVALID_TRANSACTION_ID', 'Transaction ID must be a string', { id })
    invariant(id.startsWith('txn-'), 'INVALID_TRANSACTION_ID_FORMAT', 'Transaction ID must start with "txn-"', { id })
}

export function validateSequence(current: number, previous: number): void {
    assertPositive(current, 'INVALID_SEQUENCE', 'Sequence must be positive', { current })
    assertMonotonic(current, previous, 'SEQUENCE_NOT_MONOTONIC', 'Sequence must be monotonically increasing', { current, previous })
}

export function validateRevision(current: number, previous: number): void {
    assertPositive(current, 'INVALID_REVISION', 'Revision must be positive', { current })
}

export function validateIntentOrder(intents: readonly TransportIntent[]): void {
    for (let i = 1; i < intents.length; i++) {
        const prev = intents[i - 1]
        const curr = intents[i]
        invariant(
            curr.sequence >= prev.sequence,
            'INTENT_ORDER_VIOLATION',
            'Intents must be ordered by sequence',
            { prevSeq: prev.sequence, currSeq: curr.sequence }
        )
    }
}

export function validateTransactionImmutable(transaction: ExecutionTransaction): void {
    invariant(Object.isFrozen(transaction), 'TRANSACTION_NOT_FROZEN', 'Transaction must be frozen', { id: transaction.id })

    const intents = transaction.transportIntents
    invariant(Object.isFrozen(intents), 'INTENTS_NOT_FROZEN', 'Intents array must be frozen', {})

    for (const intent of intents) {
        invariant(Object.isFrozen(intent), 'INTENT_NOT_FROZEN', 'Each intent must be frozen', { intentId: intent.id })
    }
}

export function validateIntentId(id: string): void {
    assertString(id, 'INVALID_INTENT_ID', 'Intent ID must be a string', { id })
    invariant(id.startsWith('intent-'), 'INVALID_INTENT_ID_FORMAT', 'Intent ID must start with "intent-"', { id })
}

export function validateAppendResult(original: ExecutionTransaction, result: ExecutionTransaction): void {
    invariant(original.id === result.id, 'ID_MUTATION', 'Transaction ID must not change on append', {})

    invariant(result.sequence >= original.sequence, 'SEQUENCE_NOT_INCREMENTED', 'Sequence must increment on append', { originalSeq: original.sequence, resultSeq: result.sequence })

    invariant(result.transportIntents.length >= original.transportIntents.length, 'INTENT_COUNT_REDUCED', 'Intent count must not decrease', { original: original.transportIntents.length, result: result.transportIntents.length })
}

export function validateNoIntentMutation(original: ExecutionTransaction, result: ExecutionTransaction): void {
    for (let i = 0; i < original.transportIntents.length; i++) {
        const origIntent = original.transportIntents[i]
        const resultIntent = result.transportIntents[i]
        invariant(origIntent.id === resultIntent.id, 'ORIGINAL_INTENT_MUTATED', 'Original intents must not be mutated', { index: i, origId: origIntent.id, resultId: resultIntent.id })
    }
}