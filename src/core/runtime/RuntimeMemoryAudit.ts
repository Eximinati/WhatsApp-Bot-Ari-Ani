import type { AuthoritativeCommitRegistry } from '../transport/AuthoritativeCommitRegistry.js'
import type { StateSnapshot, StateManager } from '../state/index.js'

export interface MemorySnapshot {
    timestamp: number
    activeTransactions: number
    auditLogSize: number
    commitRegistrySize: number
    snapshotCount: number
    replayCacheSize: number
    middlewareRefs: number
}

export interface MemoryTrend {
    snapshots: MemorySnapshot[]
    activeTransactionGrowth: number
    auditLogGrowth: number
    commitRegistryGrowth: number
    snapshotGrowth: number
    memoryLeakDetected: boolean
}

export class RuntimeMemoryAudit {
    private snapshots: MemorySnapshot[] = []
    private activeTransactionIds = new Set<string>()
    private auditLog: unknown[] = []
    private snapshotIds = new Set<string>()
    private middlewareRefs = new Set<string>()

    constructor() {
        this.snapshots = []
    }

    capture(
        commitRegistry: AuthoritativeCommitRegistry,
        stateManager: StateManager | null
    ): MemorySnapshot {
        const reservations = commitRegistry.getAllReservations()

        const snapshot: MemorySnapshot = {
            timestamp: Date.now(),
            activeTransactions: this.activeTransactionIds.size,
            auditLogSize: this.auditLog.length,
            commitRegistrySize: reservations.length,
            snapshotCount: stateManager ? this.countSnapshots(stateManager) : 0,
            replayCacheSize: 0,
            middlewareRefs: this.middlewareRefs.size
        }

        this.snapshots.push(snapshot)
        return snapshot
    }

    private countSnapshots(stateManager: StateManager): number {
        return this.snapshotIds.size
    }

    trackTransactionStart(transactionId: string): void {
        this.activeTransactionIds.add(transactionId)
    }

    trackTransactionEnd(transactionId: string): void {
        this.activeTransactionIds.delete(transactionId)
    }

    trackAuditRecord(record: unknown): void {
        this.auditLog.push(record)
    }

    trackSnapshot(snapshotId: string): void {
        this.snapshotIds.add(snapshotId)
    }

    trackMiddlewareRef(ref: string): void {
        this.middlewareRefs.add(ref)
    }

    releaseMiddlewareRef(ref: string): void {
        this.middlewareRefs.delete(ref)
    }

    releaseSnapshot(snapshotId: string): void {
        this.snapshotIds.delete(snapshotId)
    }

    analyze(): MemoryTrend {
        if (this.snapshots.length < 2) {
            return {
                snapshots: [...this.snapshots],
                activeTransactionGrowth: 0,
                auditLogGrowth: 0,
                commitRegistryGrowth: 0,
                snapshotGrowth: 0,
                memoryLeakDetected: false
            }
        }

        const first = this.snapshots[0]
        const last = this.snapshots[this.snapshots.length - 1]

        const activeTransactionGrowth = last.activeTransactions - first.activeTransactions
        const auditLogGrowth = last.auditLogSize - first.auditLogSize
        const commitRegistryGrowth = last.commitRegistrySize - first.commitRegistrySize
        const snapshotGrowth = last.snapshotCount - first.snapshotCount

        const activeTransactionsUnreleased = this.activeTransactionIds.size > 0
        const snapshotsUnreleased = this.snapshotIds.size > 100
        const middlewareRefsLeaked = this.middlewareRefs.size > 0

        const memoryLeakDetected = activeTransactionsUnreleased ||
            snapshotsUnreleased ||
            middlewareRefsLeaked ||
            activeTransactionGrowth > 10 ||
            auditLogGrowth > 1000 ||
            commitRegistryGrowth > 100

        return {
            snapshots: [...this.snapshots],
            activeTransactionGrowth,
            auditLogGrowth,
            commitRegistryGrowth,
            snapshotGrowth,
            memoryLeakDetected
        }
    }

    stressTest(
        iterations: number,
        executeFn: (i: number) => void
    ): { completed: boolean; leaks: string[] } {
        const leaks: string[] = []
        const initialSnapshot = this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null

        for (let i = 0; i < iterations; i++) {
            executeFn(i)

            if (this.activeTransactionIds.size > iterations * 0.5) {
                leaks.push(`Iteration ${i}: ${this.activeTransactionIds.size} unreleased transactions`)
            }

            if (this.auditLog.length > iterations * 2) {
                leaks.push(`Iteration ${i}: ${this.auditLog.length} audit records accumulated`)
            }
        }

        const finalSnapshot = this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null

        if (initialSnapshot && finalSnapshot) {
            if (finalSnapshot.activeTransactions > initialSnapshot.activeTransactions + 10) {
                leaks.push(`Transaction leak: ${initialSnapshot.activeTransactions} -> ${finalSnapshot.activeTransactions}`)
            }

            if (finalSnapshot.auditLogSize > initialSnapshot.auditLogSize + 500) {
                leaks.push(`Audit leak: ${initialSnapshot.auditLogSize} -> ${finalSnapshot.auditLogSize}`)
            }

            if (finalSnapshot.commitRegistrySize > initialSnapshot.commitRegistrySize + 100) {
                leaks.push(`Commit registry leak: ${initialSnapshot.commitRegistrySize} -> ${finalSnapshot.commitRegistrySize}`)
            }
        }

        return {
            completed: true,
            leaks
        }
    }

    verifyCleanup(registry: AuthoritativeCommitRegistry): {
        orphanedReservations: string[]
        uncommittedTransactions: string[]
        cleanupNeeded: boolean
    } {
        const reservations = registry.getAllReservations()
        const orphaned: string[] = []
        const uncommitted: string[] = []

        for (const r of reservations) {
            if (r.state === CommitState.RESERVED) {
                orphaned.push(r.intentId)
            }
            if (r.state !== CommitState.COMMITTED) {
                uncommitted.push(r.intentId)
            }
        }

        return {
            orphanedReservations: orphaned,
            uncommittedTransactions: uncommitted,
            cleanupNeeded: orphaned.length > 10 || uncommitted.length > 50
        }
    }

    getCurrentState(): {
        activeTransactions: number
        auditLogSize: number
        snapshotCount: number
        middlewareRefs: number
    } {
        return {
            activeTransactions: this.activeTransactionIds.size,
            auditLogSize: this.auditLog.length,
            snapshotCount: this.snapshotIds.size,
            middlewareRefs: this.middlewareRefs.size
        }
    }

    reset(): void {
        this.snapshots = []
        this.activeTransactionIds.clear()
        this.auditLog = []
        this.snapshotIds.clear()
        this.middlewareRefs.clear()
    }
}

export function createMemoryLeakTest(iterations: number = 1000): {
    run: () => Promise<{ passed: boolean; details: string[] }>
} {
    const audit = new RuntimeMemoryAudit()

    return {
        run: async () => {
            const details: string[] = []

            for (let i = 0; i < iterations; i++) {
                audit.trackTransactionStart(`txn-${i}`)
                audit.trackAuditRecord({ index: i })
                audit.trackSnapshot(`snap-${i}`)

                if (i % 100 === 0) {
                    audit.trackTransactionEnd(`txn-${i - 50}`)
                }
            }

            const state = audit.getCurrentState()

            if (state.activeTransactions > iterations * 0.4) {
                details.push(`Active transactions not cleaned: ${state.activeTransactions}`)
            }

            if (state.auditLogSize > iterations * 0.8) {
                details.push(`Audit log growing unbounded: ${state.auditLogSize}`)
            }

            return {
                passed: details.length === 0,
                details
            }
        }
    }
}

enum CommitState {
    RESERVED = 'RESERVED',
    COMMITTED = 'COMMITTED',
    FAILED = 'FAILED'
}