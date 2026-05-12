import type { ExecutionResult } from '../execution/ExecutionCoordinator.js'
import type { TransportIntent } from '../transport/types.js'

export interface ExecutionTelemetry {
    timestamp: number
    executionId: string
    command: string
    phase: string
    durationMs: number
    middlewareDurationMs: number
    commitDurationMs: number
    intentsQueued: number
    intentsCommitted: number
    intentsFailed: number
    success: boolean
    errorType?: string
}

export interface CommitTelemetry {
    timestamp: number
    transactionId: string
    intentCount: number
    successCount: number
    failureCount: number
    totalDurationMs: number
    retryCount: number
    errors: string[]
}

export interface QueueTelemetry {
    timestamp: number
    pendingIntents: number
    committedIntents: number
    failedIntents: number
    averageWaitTimeMs: number
}

export interface MiddlewareTelemetry {
    timestamp: number
    executionId: string
    phase: string
    middlewareName: string
    durationMs: number
    vetoed: boolean
}

export class RuntimeTelemetry {
    private executionTelemetry: ExecutionTelemetry[] = []
    private commitTelemetry: CommitTelemetry[] = []
    private queueTelemetry: QueueTelemetry[] = []
    private middlewareTelemetry: MiddlewareTelemetry[] = []

    private maxTelemetrySize = 1000

    recordExecution(result: ExecutionResult, command: string, middlewareDuration: number = 0, commitDuration: number = 0): void {
        const telemetry: ExecutionTelemetry = {
            timestamp: Date.now(),
            executionId: result.executionId,
            command,
            phase: result.phase,
            durationMs: result.durationMs,
            middlewareDurationMs: middlewareDuration,
            commitDurationMs: commitDuration,
            intentsQueued: result.intents.length,
            intentsCommitted: result.intents.filter(i => true).length,
            intentsFailed: 0,
            success: result.success,
            errorType: result.error?.name
        }
        
        this.executionTelemetry.push(telemetry)
        if (this.executionTelemetry.length > this.maxTelemetrySize) {
            this.executionTelemetry.shift()
        }
    }

    recordCommit(transactionId: string, intents: readonly TransportIntent[], duration: number, errors: string[] = []): void {
        const telemetry: CommitTelemetry = {
            timestamp: Date.now(),
            transactionId,
            intentCount: intents.length,
            successCount: intents.length - errors.length,
            failureCount: errors.length,
            totalDurationMs: duration,
            retryCount: 0,
            errors
        }
        
        this.commitTelemetry.push(telemetry)
        if (this.commitTelemetry.length > this.maxTelemetrySize) {
            this.commitTelemetry.shift()
        }
    }

    recordQueueState(pending: number, committed: number, failed: number, avgWait: number): void {
        const telemetry: QueueTelemetry = {
            timestamp: Date.now(),
            pendingIntents: pending,
            committedIntents: committed,
            failedIntents: failed,
            averageWaitTimeMs: avgWait
        }
        
        this.queueTelemetry.push(telemetry)
        if (this.queueTelemetry.length > this.maxTelemetrySize) {
            this.queueTelemetry.shift()
        }
    }

    recordMiddleware(executionId: string, phase: string, name: string, duration: number, vetoed: boolean): void {
        const telemetry: MiddlewareTelemetry = {
            timestamp: Date.now(),
            executionId,
            phase,
            middlewareName: name,
            durationMs: duration,
            vetoed
        }
        
        this.middlewareTelemetry.push(telemetry)
        if (this.middlewareTelemetry.length > this.maxTelemetrySize) {
            this.middlewareTelemetry.shift()
        }
    }

    getExecutionStats(): {
        totalExecutions: number
        successfulExecutions: number
        failedExecutions: number
        averageLatencyMs: number
        p50LatencyMs: number
        p95LatencyMs: number
        p99LatencyMs: number
    } {
        if (this.executionTelemetry.length === 0) {
            return { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0, averageLatencyMs: 0, p50LatencyMs: 0, p95LatencyMs: 0, p99LatencyMs: 0 }
        }

        const sorted = [...this.executionTelemetry].sort((a, b) => a.durationMs - b.durationMs)
        const successful = this.executionTelemetry.filter(e => e.success).length
        const total = this.executionTelemetry.length
        const sum = this.executionTelemetry.reduce((acc, e) => acc + e.durationMs, 0)

        return {
            totalExecutions: total,
            successfulExecutions: successful,
            failedExecutions: total - successful,
            averageLatencyMs: sum / total,
            p50LatencyMs: sorted[Math.floor(sorted.length * 0.5)].durationMs,
            p95LatencyMs: sorted[Math.floor(sorted.length * 0.95)].durationMs,
            p99LatencyMs: sorted[Math.floor(sorted.length * 0.99)].durationMs
        }
    }

    getCommitStats(): {
        totalCommits: number
        successfulCommits: number
        failedCommits: number
        totalIntents: number
        averageDurationMs: number
    } {
        if (this.commitTelemetry.length === 0) {
            return { totalCommits: 0, successfulCommits: 0, failedCommits: 0, totalIntents: 0, averageDurationMs: 0 }
        }

        const successful = this.commitTelemetry.filter(c => c.failureCount === 0).length
        const total = this.commitTelemetry.length
        const totalIntents = this.commitTelemetry.reduce((acc, c) => acc + c.intentCount, 0)
        const sum = this.commitTelemetry.reduce((acc, c) => acc + c.totalDurationMs, 0)

        return {
            totalCommits: total,
            successfulCommits: successful,
            failedCommits: total - successful,
            totalIntents,
            averageDurationMs: sum / total
        }
    }

    getMiddlewareStats(): {
        totalMiddlewareCalls: number
        totalVetoes: number
        averageDurationMs: number
        byMiddleware: Map<string, { calls: number; vetoes: number; avgDuration: number }>
    } {
        const byMiddleware = new Map<string, { calls: number; vetoes: number; totalDuration: number }>()

        for (const m of this.middlewareTelemetry) {
            const existing = byMiddleware.get(m.middlewareName) || { calls: 0, vetoes: 0, totalDuration: 0 }
            existing.calls++
            if (m.vetoed) existing.vetoes++
            existing.totalDuration += m.durationMs
            byMiddleware.set(m.middlewareName, existing)
        }

        const middlewareStats = new Map<string, { calls: number; vetoes: number; avgDuration: number }>()
        for (const [name, stats] of byMiddleware) {
            middlewareStats.set(name, {
                calls: stats.calls,
                vetoes: stats.vetoes,
                avgDuration: stats.totalDuration / stats.calls
            })
        }

        return {
            totalMiddlewareCalls: this.middlewareTelemetry.length,
            totalVetoes: this.middlewareTelemetry.filter(m => m.vetoed).length,
            averageDurationMs: this.middlewareTelemetry.reduce((acc, m) => acc + m.durationMs, 0) / Math.max(1, this.middlewareTelemetry.length),
            byMiddleware: middlewareStats
        }
    }

    getQueueStats(): {
        currentPending: number
        currentCommitted: number
        currentFailed: number
        averageWaitMs: number
    } {
        const latest = this.queueTelemetry[this.queueTelemetry.length - 1]
        if (!latest) {
            return { currentPending: 0, currentCommitted: 0, currentFailed: 0, averageWaitMs: 0 }
        }

        const avgWait = this.queueTelemetry.reduce((acc, q) => acc + q.averageWaitTimeMs, 0) / Math.max(1, this.queueTelemetry.length)

        return {
            currentPending: latest.pendingIntents,
            currentCommitted: latest.committedIntents,
            currentFailed: latest.failedIntents,
            averageWaitMs: avgWait
        }
    }

    generateReport(): string {
        const execStats = this.getExecutionStats()
        const commitStats = this.getCommitStats()
        const middlewareStats = this.getMiddlewareStats()
        const queueStats = this.getQueueStats()

        const lines: string[] = []
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('                    PRODUCTION TELEMETRY REPORT')
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('')
        
        lines.push('─────────────────── EXECUTION STATS ───────────────────')
        lines.push(`Total Executions: ${execStats.totalExecutions}`)
        lines.push(`Successful: ${execStats.successfulExecutions}`)
        lines.push(`Failed: ${execStats.failedExecutions}`)
        lines.push(`Average Latency: ${execStats.averageLatencyMs.toFixed(2)}ms`)
        lines.push(`P50 Latency: ${execStats.p50LatencyMs.toFixed(2)}ms`)
        lines.push(`P95 Latency: ${execStats.p95LatencyMs.toFixed(2)}ms`)
        lines.push(`P99 Latency: ${execStats.p99LatencyMs.toFixed(2)}ms`)
        lines.push('')
        
        lines.push('─────────────────── COMMIT STATS ───────────────────')
        lines.push(`Total Commits: ${commitStats.totalCommits}`)
        lines.push(`Successful: ${commitStats.successfulCommits}`)
        lines.push(`Failed: ${commitStats.failedCommits}`)
        lines.push(`Total Intents: ${commitStats.totalIntents}`)
        lines.push(`Average Duration: ${commitStats.averageDurationMs.toFixed(2)}ms`)
        lines.push('')
        
        lines.push('─────────────────── MIDDLEWARE STATS ───────────────────')
        lines.push(`Total Calls: ${middlewareStats.totalMiddlewareCalls}`)
        lines.push(`Total Vetoes: ${middlewareStats.totalVetoes}`)
        lines.push(`Average Duration: ${middlewareStats.averageDurationMs.toFixed(2)}ms`)
        for (const [name, stats] of middlewareStats.byMiddleware) {
            lines.push(`  ${name}: ${stats.calls} calls, ${stats.vetoes} vetoes, ${stats.avgDuration.toFixed(2)}ms avg`)
        }
        lines.push('')
        
        lines.push('─────────────────── QUEUE STATS ───────────────────')
        lines.push(`Pending: ${queueStats.currentPending}`)
        lines.push(`Committed: ${queueStats.currentCommitted}`)
        lines.push(`Failed: ${queueStats.currentFailed}`)
        lines.push(`Average Wait: ${queueStats.averageWaitMs.toFixed(2)}ms`)
        lines.push('')
        
        lines.push('═══════════════════════════════════════════════════════════════')

        return lines.join('\n')
    }

    reset(): void {
        this.executionTelemetry = []
        this.commitTelemetry = []
        this.queueTelemetry = []
        this.middlewareTelemetry = []
    }
}