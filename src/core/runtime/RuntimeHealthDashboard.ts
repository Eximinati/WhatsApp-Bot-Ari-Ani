export interface HealthSnapshot {
    timestamp: number
    executionThroughput: number
    queueDepth: number
    commitLatencyMs: number
    replayDivergenceRate: number
    memoryUsageMB: number
    activeTransactions: number
    middlewareVetoRate: number
    transportFailureRate: number
    shadowDivergenceRate: number
    commandMigrationProgressPct: number
}

export interface HealthThresholds {
    executionThroughputMin: number
    queueDepthMax: number
    commitLatencyMsMax: number
    replayDivergenceRateMax: number
    memoryUsageMBMax: number
    activeTransactionsMax: number
    middlewareVetoRateMax: number
    transportFailureRateMax: number
    shadowDivergenceRateMax: number
}

export interface HealthStatus {
    overall: 'healthy' | 'degraded' | 'unhealthy'
    components: Record<string, 'healthy' | 'degraded' | 'unhealthy'>
    score: number
    alerts: string[]
    recommendations: string[]
}

export interface HealthReport {
    generatedAt: number
    currentStatus: HealthStatus
    snapshots: HealthSnapshot[]
    trends: {
        throughput: 'increasing' | 'stable' | 'decreasing'
        latency: 'improving' | 'stable' | 'degrading'
        memory: 'stable' | 'growing' | 'shrinking'
        divergence: 'improving' | 'stable' | 'worsening'
    }
    productionReadinessScore: number
    readiness: 'production_ready' | 'needs_attention' | 'not_ready'
}

export class RuntimeHealthDashboard {
    private snapshots: HealthSnapshot[] = []
    private maxSnapshots = 100
    private thresholds: HealthThresholds = {
        executionThroughputMin: 10,
        queueDepthMax: 100,
        commitLatencyMsMax: 500,
        replayDivergenceRateMax: 0.05,
        memoryUsageMBMax: 512,
        activeTransactionsMax: 50,
        middlewareVetoRateMax: 0.1,
        transportFailureRateMax: 0.05,
        shadowDivergenceRateMax: 0.1
    }

    constructor(thresholds?: Partial<HealthThresholds>) {
        if (thresholds) {
            this.thresholds = { ...this.thresholds, ...thresholds }
        }
    }

    recordSnapshot(snapshot: HealthSnapshot): void {
        this.snapshots.push(snapshot)
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift()
        }
    }

    recordMetrics(
        throughput: number,
        queueDepth: number,
        commitLatencyMs: number,
        replayDivergenceRate: number,
        memoryUsageMB: number,
        activeTransactions: number,
        middlewareVetoRate: number,
        transportFailureRate: number,
        shadowDivergenceRate: number,
        migrationProgressPct: number
    ): void {
        const snapshot: HealthSnapshot = {
            timestamp: Date.now(),
            executionThroughput: throughput,
            queueDepth,
            commitLatencyMs,
            replayDivergenceRate,
            memoryUsageMB,
            activeTransactions,
            middlewareVetoRate,
            transportFailureRate,
            shadowDivergenceRate,
            commandMigrationProgressPct: migrationProgressPct
        }

        this.recordSnapshot(snapshot)
    }

    private evaluateComponent(name: string, value: number, healthy: number, degraded: number, isMax = true): 'healthy' | 'degraded' | 'unhealthy' {
        if (isMax) {
            if (value <= healthy) return 'healthy'
            if (value <= degraded) return 'degraded'
            return 'unhealthy'
        } else {
            if (value >= healthy) return 'healthy'
            if (value >= degraded) return 'degraded'
            return 'unhealthy'
        }
    }

    getCurrentStatus(): HealthStatus {
        const latest = this.snapshots[this.snapshots.length - 1]
        if (!latest) {
            return {
                overall: 'unknown' as any,
                components: {},
                score: 0,
                alerts: ['No health data available'],
                recommendations: ['Wait for health metrics to accumulate']
            }
        }

        const components: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {}

        components.throughput = this.evaluateComponent('throughput', latest.executionThroughput, 50, 10, false)
        components.queueDepth = this.evaluateComponent('queueDepth', latest.queueDepth, 20, 100, true)
        components.commitLatency = this.evaluateComponent('commitLatency', latest.commitLatencyMs, 100, 500, true)
        components.replayDivergence = this.evaluateComponent('replayDivergence', latest.replayDivergenceRate, 0.01, 0.05, true)
        components.memory = this.evaluateComponent('memory', latest.memoryUsageMB, 256, 512, true)
        components.activeTransactions = this.evaluateComponent('activeTransactions', latest.activeTransactions, 10, 50, true)
        components.middlewareVeto = this.evaluateComponent('middlewareVeto', latest.middlewareVetoRate, 0.01, 0.1, true)
        components.transportFailure = this.evaluateComponent('transportFailure', latest.transportFailureRate, 0.01, 0.05, true)
        components.shadowDivergence = this.evaluateComponent('shadowDivergence', latest.shadowDivergenceRate, 0.02, 0.1, true)
        components.migration = latest.commandMigrationProgressPct >= 80 ? 'healthy' : latest.commandMigrationProgressPct >= 50 ? 'degraded' : 'unhealthy'

        let unhealthyCount = 0
        let degradedCount = 0

        for (const status of Object.values(components)) {
            if (status === 'unhealthy') unhealthyCount++
            else if (status === 'degraded') degradedCount++
        }

        const healthyCount = Object.keys(components).length - unhealthyCount - degradedCount
        const score = Math.round((healthyCount / Object.keys(components).length) * 100)

        let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
        if (unhealthyCount > 2) overall = 'unhealthy'
        else if (unhealthyCount > 0 || degradedCount > 3) overall = 'degraded'

        const alerts: string[] = []
        const recommendations: string[] = []

        if (components.throughput === 'unhealthy') {
            alerts.push('Execution throughput critically low')
            recommendations.push('Scale up execution capacity or investigate bottlenecks')
        }
        if (components.commitLatency === 'unhealthy') {
            alerts.push('Commit latency exceeds acceptable threshold')
            recommendations.push('Investigate transport commit performance')
        }
        if (components.memory === 'unhealthy') {
            alerts.push('Memory usage exceeds safe threshold')
            recommendations.push('Check for memory leaks or increase memory allocation')
        }
        if (components.transportFailure === 'unhealthy') {
            alerts.push('Transport failure rate too high')
            recommendations.push('Review transport layer stability')
        }
        if (components.shadowDivergence === 'unhealthy') {
            alerts.push('Shadow mode divergence rate too high')
            recommendations.push('Review command migration and shadow mode configuration')
        }
        if (components.migration === 'unhealthy') {
            alerts.push('Command migration progress insufficient')
            recommendations.push('Accelerate command migration to runtime pipeline')
        }
        if (components.activeTransactions === 'degraded') {
            alerts.push('High number of active transactions')
            recommendations.push('Monitor transaction cleanup and queue depth')
        }

        return { overall, components, score, alerts, recommendations }
    }

    getTrends(): HealthReport['trends'] {
        if (this.snapshots.length < 5) {
            return {
                throughput: 'stable',
                latency: 'stable',
                memory: 'stable',
                divergence: 'stable'
            }
        }

        const recent = this.snapshots.slice(-10)
        const older = this.snapshots.slice(-20, -10)

        const avgRecentThroughput = recent.reduce((acc, s) => acc + s.executionThroughput, 0) / recent.length
        const avgOlderThroughput = older.length > 0 ? older.reduce((acc, s) => acc + s.executionThroughput, 0) / older.length : avgRecentThroughput
        const throughputTrend = avgRecentThroughput > avgOlderThroughput * 1.1 ? 'increasing' : avgRecentThroughput < avgOlderThroughput * 0.9 ? 'decreasing' : 'stable'

        const avgRecentLatency = recent.reduce((acc, s) => acc + s.commitLatencyMs, 0) / recent.length
        const avgOlderLatency = older.length > 0 ? older.reduce((acc, s) => acc + s.commitLatencyMs, 0) / older.length : avgRecentLatency
        const latencyTrend = avgRecentLatency < avgOlderLatency * 0.9 ? 'improving' : avgRecentLatency > avgOlderLatency * 1.1 ? 'degrading' : 'stable'

        const avgRecentMemory = recent.reduce((acc, s) => acc + s.memoryUsageMB, 0) / recent.length
        const avgOlderMemory = older.length > 0 ? older.reduce((acc, s) => acc + s.memoryUsageMB, 0) / older.length : avgRecentMemory
        const memoryTrend = avgRecentMemory > avgOlderMemory * 1.05 ? 'growing' : avgRecentMemory < avgOlderMemory * 0.95 ? 'shrinking' : 'stable'

        const avgRecentDiv = recent.reduce((acc, s) => acc + s.replayDivergenceRate + s.shadowDivergenceRate, 0) / recent.length
        const avgOlderDiv = older.length > 0 ? older.reduce((acc, s) => acc + s.replayDivergenceRate + s.shadowDivergenceRate, 0) / older.length : avgRecentDiv
        const divergenceTrend = avgRecentDiv < avgOlderDiv * 0.9 ? 'improving' : avgRecentDiv > avgOlderDiv * 1.1 ? 'worsening' : 'stable'

        return {
            throughput: throughputTrend,
            latency: latencyTrend,
            memory: memoryTrend,
            divergence: divergenceTrend
        }
    }

    getProductionReadinessScore(): number {
        const status = this.getCurrentStatus()
        const trends = this.getTrends()

        let score = status.score

        if (trends.latency === 'degrading') score -= 10
        if (trends.memory === 'growing') score -= 10
        if (trends.divergence === 'worsening') score -= 10

        if (status.alerts.length === 0 && score >= 80) score += 10

        const latest = this.snapshots[this.snapshots.length - 1]
        if (latest && latest.commandMigrationProgressPct < 50) score -= 20
        if (latest && latest.replayDivergenceRate > 0.1) score -= 15
        if (latest && latest.transportFailureRate > 0.1) score -= 15

        return Math.max(0, Math.min(100, score))
    }

    generateReport(): HealthReport {
        const status = this.getCurrentStatus()
        const trends = this.getTrends()
        const score = this.getProductionReadinessScore()

        let readiness: 'production_ready' | 'needs_attention' | 'not_ready' = 'production_ready'
        if (score < 50 || status.overall === 'unhealthy') {
            readiness = 'not_ready'
        } else if (score < 80 || status.overall === 'degraded') {
            readiness = 'needs_attention'
        }

        return {
            generatedAt: Date.now(),
            currentStatus: status,
            snapshots: [...this.snapshots],
            trends,
            productionReadinessScore: score,
            readiness
        }
    }

    printDashboard(report: HealthReport): string {
        const lines: string[] = []
        lines.push('╔══════════════════════════════════════════════════════════════════════╗')
        lines.push('║                    RUNTIME HEALTH DASHBOARD                         ║')
        lines.push('╚══════════════════════════════════════════════════════════════════════╝')
        lines.push('')

        const statusChar = report.currentStatus.overall === 'healthy' ? '✓' : report.currentStatus.overall === 'degraded' ? '⚠' : '✗'
        lines.push(`Overall Status: ${statusChar} ${report.currentStatus.overall.toUpperCase()}`)
        lines.push(`Health Score: ${report.currentStatus.score}/100`)
        lines.push(`Production Readiness: ${report.currentStatus.score >= 80 ? '✓' : report.currentStatus.score >= 50 ? '⚠' : '✗'} ${report.readiness.replace('_', ' ').toUpperCase()}`)
        lines.push(`Readiness Score: ${report.productionReadinessScore}/100`)
        lines.push('')

        lines.push('─────────────────── COMPONENT HEALTH ───────────────────')
        const components = report.currentStatus.components
        for (const [name, status] of Object.entries(components)) {
            const char = status === 'healthy' ? '✓' : status === 'degraded' ? '⚠' : '✗'
            lines.push(`  ${char} ${name.padEnd(20)}: ${status}`)
        }
        lines.push('')

        lines.push('─────────────────── TRENDS ───────────────────')
        const trendIcon = (t: string) => t === 'stable' ? '→' : t === 'increasing' || t === 'improving' ? '↑' : '↓'
        lines.push(`  Throughput: ${trendIcon(report.trends.throughput)} ${report.trends.throughput}`)
        lines.push(`  Latency:    ${trendIcon(report.trends.latency)} ${report.trends.latency}`)
        lines.push(`  Memory:     ${trendIcon(report.trends.memory)} ${report.trends.memory}`)
        lines.push(`  Divergence: ${trendIcon(report.trends.divergence)} ${report.trends.divergence}`)
        lines.push('')

        const latest = report.snapshots[report.snapshots.length - 1]
        if (latest) {
            lines.push('─────────────────── LATEST METRICS ───────────────────')
            lines.push(`  Execution Throughput:  ${latest.executionThroughput.toFixed(1)}/s`)
            lines.push(`  Queue Depth:          ${latest.queueDepth}`)
            lines.push(`  Commit Latency:       ${latest.commitLatencyMs.toFixed(1)}ms`)
            lines.push(`  Replay Divergence:    ${(latest.replayDivergenceRate * 100).toFixed(2)}%`)
            lines.push(`  Memory Usage:         ${latest.memoryUsageMB.toFixed(1)}MB`)
            lines.push(`  Active Transactions:  ${latest.activeTransactions}`)
            lines.push(`  Middleware Veto Rate: ${(latest.middlewareVetoRate * 100).toFixed(2)}%`)
            lines.push(`  Transport Failure:    ${(latest.transportFailureRate * 100).toFixed(2)}%`)
            lines.push(`  Shadow Divergence:    ${(latest.shadowDivergenceRate * 100).toFixed(2)}%`)
            lines.push(`  Migration Progress:   ${latest.commandMigrationProgressPct.toFixed(1)}%`)
            lines.push('')
        }

        if (report.currentStatus.alerts.length > 0) {
            lines.push('─────────────────── ALERTS ───────────────────')
            for (const alert of report.currentStatus.alerts) {
                lines.push(`  ⚠ ${alert}`)
            }
            lines.push('')
        }

        if (report.currentStatus.recommendations.length > 0) {
            lines.push('─────────────────── RECOMMENDATIONS ───────────────────')
            for (const rec of report.currentStatus.recommendations) {
                lines.push(`  → ${rec}`)
            }
            lines.push('')
        }

        lines.push('─────────────────── HISTORY (last 5) ───────────────────')
        const history = report.snapshots.slice(-5)
        for (let i = 0; i < history.length; i++) {
            const s = history[i]
            const time = new Date(s.timestamp).toLocaleTimeString()
            lines.push(`  [${time}] throughput=${s.executionThroughput.toFixed(0)}, latency=${s.commitLatencyMs.toFixed(0)}ms, mem=${s.memoryUsageMB.toFixed(0)}MB`)
        }

        lines.push('')
        lines.push('═══════════════════════════════════════════════════════════════════════')

        return lines.join('\n')
    }

    printSimpleReport(report: HealthReport): string {
        const lines: string[] = []
        lines.push('')
        lines.push('┌─────────────────────────────────────────────────────────────┐')
        lines.push('│                    RUNTIME HEALTH SUMMARY                   │')
        lines.push('└─────────────────────────────────────────────────────────────┘')
        lines.push('')

        const status = report.currentStatus.overall === 'healthy' ? '✓ HEALTHY' : report.currentStatus.overall === 'degraded' ? '⚠ DEGRADED' : '✗ UNHEALTHY'
        lines.push(`  Overall:        ${status}`)
        lines.push(`  Score:          ${report.currentStatus.score}/100`)
        lines.push(`  Readiness:      ${report.productionReadinessScore}/100 (${report.readiness.replace('_', ' ')})`)
        lines.push('')

        const latest = report.snapshots[report.snapshots.length - 1]
        if (latest) {
            lines.push(`  Throughput:    ${latest.executionThroughput.toFixed(1)}/s`)
            lines.push(`  Latency:        ${latest.commitLatencyMs.toFixed(1)}ms`)
            lines.push(`  Memory:         ${latest.memoryUsageMB.toFixed(1)}MB`)
            lines.push(`  Migration:     ${latest.commandMigrationProgressPct.toFixed(1)}%`)
        }

        lines.push('')
        lines.push('└─────────────────────────────────────────────────────────────┘')
        lines.push('')

        return lines.join('\n')
    }

    getSnapshots(): HealthSnapshot[] {
        return [...this.snapshots]
    }

    setThresholds(thresholds: Partial<HealthThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds }
    }

    reset(): void {
        this.snapshots = []
    }
}

export function createHealthDashboard(thresholds?: Partial<HealthThresholds>): RuntimeHealthDashboard {
    return new RuntimeHealthDashboard(thresholds)
}

export function simulateHealthMetrics(dashboard: RuntimeHealthDashboard): void {
    const now = Date.now()
    const hour = 3600000

    for (let i = 0; i < 50; i++) {
        const timestamp = now - (50 - i) * 60000

        const baseThroughput = 50 + Math.sin(i / 10) * 10 + Math.random() * 5
        const baseLatency = 100 + Math.cos(i / 8) * 30 + Math.random() * 20
        const baseMemory = 300 + Math.sin(i / 5) * 50 + Math.random() * 30

        dashboard.recordMetrics(
            baseThroughput,
            10 + Math.floor(Math.random() * 20),
            baseLatency,
            0.01 + Math.random() * 0.03,
            baseMemory,
            5 + Math.floor(Math.random() * 15),
            0.02 + Math.random() * 0.05,
            0.01 + Math.random() * 0.02,
            0.03 + Math.random() * 0.05,
            65 + (i / 50) * 30
        )
    }
}