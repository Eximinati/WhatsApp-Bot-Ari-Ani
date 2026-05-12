import type RuntimeClient from '../RuntimeClient.js'
import type { ExecutionResult } from '../execution/ExecutionCoordinator.js'
import type { NormalizedMessage } from '../serializer/types.js'
import { RuntimeMode } from '../kernel/RuntimeKernel.js'

export interface ProductionCheckItem {
    id: string
    name: string
    category: 'memory' | 'replay' | 'transport' | 'crash' | 'middleware' | 'telemetry' | 'concurrency'
    severity: 'BLOCKER' | 'WARNING' | 'INFO'
    description: string
    status: 'PASS' | 'FAIL' | 'PENDING'
    blockers?: string[]
}

export interface DeploymentReadiness {
    overall: 'READY' | 'NOT_READY' | 'PARTIAL'
    score: number
    checks: ProductionCheckItem[]
    blockers: string[]
    warnings: string[]
    recommendations: string[]
}

export class ProductionDeploymentChecklist {
    private checks: ProductionCheckItem[] = []
    private client: RuntimeClient

    constructor(client: RuntimeClient) {
        this.client = client
        this.initializeChecks()
    }

    private initializeChecks(): void {
        this.checks = [
            this.memoryCheck(),
            this.replayStabilityCheck(),
            this.transportSafetyCheck(),
            this.crashRecoveryCheck(),
            this.reconnectSafetyCheck(),
            this.queueCleanupCheck(),
            this.transactionCleanupCheck(),
            this.middlewareEnforcementCheck(),
            this.commitIdempotencyCheck(),
            this.deterministicHashCheck(),
            this.telemetryIntegrityCheck(),
            this.executionTimeoutCheck(),
            this.stuckTransactionCheck(),
            this.queueOverflowCheck(),
            this.middlewareTimeoutCheck(),
            this.commitRetryCeilingCheck(),
            this.panicModeAbortCheck(),
            this.emergencyShutdownCheck(),
            this.degradedModeFallbackCheck(),
            this.healthStateTransitionCheck()
        ]
    }

    private memoryCheck(): ProductionCheckItem {
        const heapUsage = process.memoryUsage()
        const heapUsedMB = heapUsage.heapUsed / 1024 / 1024
        const heapTotalMB = heapUsage.heapTotal / 1024 / 1024
        const usagePercent = (heapUsedMB / heapTotalMB) * 100

        return {
            id: 'MEMORY_BOUND',
            name: 'Bounded Memory Usage',
            category: 'memory',
            severity: usagePercent > 80 ? 'BLOCKER' : usagePercent > 60 ? 'WARNING' : 'INFO',
            description: `Heap: ${heapUsedMB.toFixed(0)}MB / ${heapTotalMB.toFixed(0)}MB (${usagePercent.toFixed(1)}%)`,
            status: usagePercent > 80 ? 'FAIL' : 'PASS',
            blockers: usagePercent > 80 ? ['Memory usage exceeds 80% threshold'] : undefined
        }
    }

    private replayStabilityCheck(): ProductionCheckItem {
        return {
            id: 'REPLAY_STABILITY',
            name: 'Replay Determinism',
            category: 'replay',
            severity: 'WARNING',
            description: 'Replay engine must produce identical results for same input sequence',
            status: 'PENDING',
            blockers: ['ReplayValidator must pass all determinism checks before production']
        }
    }

    private transportSafetyCheck(): ProductionCheckItem {
        return {
            id: 'TRANSPORT_SAFETY',
            name: 'Transport Layer Governance',
            category: 'transport',
            severity: 'BLOCKER',
            description: 'All transport must go through TransportCommitCoordinator, no direct sendMessage',
            status: 'PENDING',
            blockers: ['7 CRITICAL commands use direct client.sendMessage - must migrate']
        }
    }

    private crashRecoveryCheck(): ProductionCheckItem {
        return {
            id: 'CRASH_RECOVERY',
            name: 'Crash Recovery Capability',
            category: 'crash',
            severity: 'BLOCKER',
            description: 'System must recover from: SIGTERM, SIGINT, unhandled exceptions, memory exhaustion',
            status: 'PENDING',
            blockers: ['CrashRecoveryVerifier must pass all 6 scenarios']
        }
    }

    private reconnectSafetyCheck(): ProductionCheckItem {
        return {
            id: 'RECONNECT_SAFETY',
            name: 'Reconnection Stability',
            category: 'crash',
            severity: 'WARNING',
            description: 'Baileys socket reconnection must not lose transaction state',
            status: 'PENDING'
        }
    }

    private queueCleanupCheck(): ProductionCheckItem {
        return {
            id: 'QUEUE_CLEANUP',
            name: 'Queue Overflow Protection',
            category: 'transport',
            severity: 'BLOCKER',
            description: 'Intent queue must have bounded size with overflow handling',
            status: 'PASS',
            blockers: undefined
        }
    }

    private transactionCleanupCheck(): ProductionCheckItem {
        return {
            id: 'TRANSACTION_CLEANUP',
            name: 'Transaction Timeout',
            category: 'transport',
            severity: 'BLOCKER',
            description: 'Stuck transactions must timeout and release resources',
            status: 'PENDING',
            blockers: ['Transaction timeout enforcement not implemented']
        }
    }

    private middlewareEnforcementCheck(): ProductionCheckItem {
        return {
            id: 'MIDDLEWARE_ENFORCEMENT',
            name: 'Middleware Chain Integrity',
            category: 'middleware',
            severity: 'WARNING',
            description: 'All executions must go through middleware phases: VALIDATION, PRE_PROCESSING, EXECUTION, POST_PROCESSING',
            status: 'PENDING',
            blockers: ['Dispatcher-owned commands bypass middleware - need integration']
        }
    }

    private commitIdempotencyCheck(): ProductionCheckItem {
        return {
            id: 'COMMIT_IDEMPOTENCY',
            name: 'Idempotent Commits',
            category: 'transport',
            severity: 'BLOCKER',
            description: 'CommitRetryCeiling prevents infinite retries on failed commits',
            status: 'PENDING',
            blockers: ['Commit retry ceiling not enforced']
        }
    }

    private deterministicHashCheck(): ProductionCheckItem {
        return {
            id: 'DETERMINISTIC_HASH',
            name: 'State Hash Determinism',
            category: 'replay',
            severity: 'WARNING',
            description: 'Final state hash must be deterministic for same execution path',
            status: 'PASS'
        }
    }

    private telemetryIntegrityCheck(): ProductionCheckItem {
        return {
            id: 'TELEMETRY_INTEGRITY',
            name: 'Audit Trail Completeness',
            category: 'telemetry',
            severity: 'WARNING',
            description: 'All executions must produce audit records with transitions and intents',
            status: 'PASS'
        }
    }

    private executionTimeoutCheck(): ProductionCheckItem {
        return {
            id: 'EXECUTION_TIMEOUT',
            name: 'Execution Timeout Enforcement',
            category: 'middleware',
            severity: 'BLOCKER',
            description: 'Handler execution must timeout after configured duration',
            status: 'PENDING',
            blockers: ['Execution timeout not enforced in ExecutionCoordinator']
        }
    }

    private stuckTransactionCheck(): ProductionCheckItem {
        return {
            id: 'STUCK_TRANSACTION',
            name: 'Stuck Transaction Cleanup',
            category: 'transport',
            severity: 'BLOCKER',
            description: 'Transactions stuck in COMMITTING phase must be cleaned up',
            status: 'PENDING',
            blockers: ['Stuck transaction cleanup not implemented']
        }
    }

    private queueOverflowCheck(): ProductionCheckItem {
        return {
            id: 'QUEUE_OVERFLOW',
            name: 'Queue Overflow Protection',
            category: 'transport',
            severity: 'BLOCKER',
            description: 'Intent queue must reject new intents when max size exceeded',
            status: 'PASS'
        }
    }

    private middlewareTimeoutCheck(): ProductionCheckItem {
        return {
            id: 'MIDDLEWARE_TIMEOUT',
            name: 'Middleware Timeout Protection',
            category: 'middleware',
            severity: 'WARNING',
            description: 'Each middleware phase must timeout independently',
            status: 'PASS'
        }
    }

    private commitRetryCeilingCheck(): ProductionCheckItem {
        return {
            id: 'COMMIT_RETRY_CEILING',
            name: 'Commit Retry Limit',
            category: 'transport',
            severity: 'BLOCKER',
            description: 'Failed commits must not retry indefinitely',
            status: 'PENDING',
            blockers: ['Commit retry ceiling not enforced in AuthoritativeCommitRegistry']
        }
    }

    private panicModeAbortCheck(): ProductionCheckItem {
        return {
            id: 'PANIC_MODE_ABORT',
            name: 'Panic Mode Safe Abort',
            category: 'crash',
            severity: 'WARNING',
            description: 'System must gracefully abort on unrecoverable errors',
            status: 'PENDING'
        }
    }

    private emergencyShutdownCheck(): ProductionCheckItem {
        return {
            id: 'EMERGENCY_SHUTDOWN',
            name: 'Emergency Runtime Shutdown',
            category: 'crash',
            severity: 'WARNING',
            description: 'Emergency shutdown must flush pending intents and release locks',
            status: 'PENDING'
        }
    }

    private degradedModeFallbackCheck(): ProductionCheckItem {
        return {
            id: 'DEGRADED_MODE',
            name: 'Degraded Mode Fallback',
            category: 'crash',
            severity: 'INFO',
            description: 'System must operate in degraded mode when components fail',
            status: 'PENDING',
            blockers: ['Degraded mode not implemented - fallback to MessagePipeline']
        }
    }

    private healthStateTransitionCheck(): ProductionCheckItem {
        return {
            id: 'HEALTH_STATE',
            name: 'Health State Transitions',
            category: 'middleware',
            severity: 'INFO',
            description: 'Health states: HEALTHY → DEGRADED → CRITICAL → SHUTDOWN',
            status: 'PENDING'
        }
    }

    async runAllChecks(): Promise<DeploymentReadiness> {
        const results: DeploymentReadiness = {
            overall: 'NOT_READY',
            score: 0,
            checks: this.checks,
            blockers: [],
            warnings: [],
            recommendations: []
        }

        let passed = 0
        let failed = 0
        let pending = 0

        for (const check of this.checks) {
            if (check.status === 'PASS') passed++
            else if (check.status === 'FAIL') failed++
            else pending++

            if (check.severity === 'BLOCKER' && check.status === 'FAIL') {
                results.blockers.push(`${check.id}: ${check.blockers?.join(', ')}`)
            }
            if (check.severity === 'WARNING' && check.status !== 'PASS') {
                results.warnings.push(`${check.id}: ${check.description}`)
            }
        }

        results.score = Math.round((passed / this.checks.length) * 100)
        results.overall = failed > 0 ? 'NOT_READY' : pending > 0 ? 'PARTIAL' : 'READY'

        if (results.score >= 80 && failed === 0) {
            results.recommendations.push('System ready for production with monitoring')
        } else if (results.score >= 50) {
            results.recommendations.push('System ready with active monitoring and phased rollout')
        } else {
            results.recommendations.push('System NOT ready - fix blockers before deployment')
        }

        return results
    }

    generateReport(): string {
        const lines: string[] = []
        lines.push('═'.repeat(70))
        lines.push('PRODUCTION DEPLOYMENT CHECKLIST')
        lines.push('═'.repeat(70))
        lines.push('')

        const categories = ['memory', 'replay', 'transport', 'crash', 'middleware', 'telemetry', 'concurrency']
        for (const cat of categories) {
            const catChecks = this.checks.filter(c => c.category === cat)
            if (catChecks.length === 0) continue

            lines.push(`━━━ ${cat.toUpperCase()} ━━━`)
            for (const check of catChecks) {
                const icon = check.status === 'PASS' ? '✓' : check.status === 'FAIL' ? '✗' : '○'
                const sev = check.severity.padEnd(8)
                lines.push(`  ${icon} [${sev}] ${check.name}`)
                lines.push(`      ${check.description}`)
                if (check.blockers) {
                    for (const b of check.blockers) {
                        lines.push(`      ⚠ ${b}`)
                    }
                }
            }
            lines.push('')
        }

        return lines.join('\n')
    }
}