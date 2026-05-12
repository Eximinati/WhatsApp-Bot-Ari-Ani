let executionCounter = 0
let transactionCounter = 0
let intentCounter = 0
let snapshotCounter = 0
let auditCounter = 0

export function resetCounters(): void {
    executionCounter = 0
    transactionCounter = 0
    intentCounter = 0
    snapshotCounter = 0
    auditCounter = 0
}

export function nextExecutionId(): string {
    return `exec-${++executionCounter}`
}

export function nextTransactionId(): string {
    return `txn-${++transactionCounter}`
}

export function nextIntentId(): string {
    return `intent-${++intentCounter}`
}

export function nextSnapshotId(): string {
    return `snap-${++snapshotCounter}`
}

export function nextAuditId(): string {
    return `audit-${++auditCounter}`
}

export function getExecutionSequence(): number {
    return executionCounter
}

export function getTransactionSequence(): number {
    return transactionCounter
}

export function getIntentSequence(): number {
    return intentCounter
}