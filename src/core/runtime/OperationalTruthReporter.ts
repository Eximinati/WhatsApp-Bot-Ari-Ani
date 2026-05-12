import type { DeterminismProof } from './DeterminismValidator.js'
import type { ReplayComparison } from './DeterminismValidator.js'
import type { StressResult } from './RuntimeStressHarness.js'
import type { MemoryTrend } from './RuntimeMemoryAudit.js'
import type { LegacyBoundaryReport } from './LegacyBoundaryAudit.js'
import type { InvariantViolationResult } from './InvariantViolationTest.js'
import type { FaultOutcome } from './TransportFaultInjector.js'

export interface OperationalTruthReport {
    generatedAt: number
    summary: {
        deterministic: boolean
        replaySafe: boolean
        concurrencySafe: boolean
        idempotent: boolean
        legacyIsolated: boolean
        invariantsEnforced: boolean
        productionReady: boolean
    }
    determinism: {
        verified: number
        total: number
        divergent: number
        failures: string[]
    }
    replay: {
        comparisonsRun: number
        matches: number
        divergences: number
        divergenceDetails: string[]
    }
    concurrency: {
        stressTestsRun: number
        totalExecutions: number
        failures: number
        duplicateCommits: number
        middlewareVetoes: number
        transportFailures: number
        invariantViolations: string[]
    }
    idempotency: {
        faultsInjected: number
        faultsWithstood: number
        unsafeFaults: number
        failureDetails: string[]
    }
    legacyIsolation: {
        dispatcherOnlyPassed: boolean
        hybridPassed: boolean
        legacyOnlyPassed: boolean
        leaks: string[]
    }
    invariants: {
        testsRun: number
        passed: number
        failed: number
        failures: string[]
    }
    memory: {
        leakDetected: boolean
        trends: MemoryTrend | null
        issues: string[]
    }
    productionReadiness: {
        ready: boolean
        blockers: string[]
        experimentalFeatures: string[]
    }
}

export class OperationalTruthReporter {
    private determinismProofs: DeterminismProof[] = []
    private replayComparisons: ReplayComparison[] = []
    private stressResults: StressResult[] = []
    private faultOutcomes: FaultOutcome[] = []
    private legacyReports: LegacyBoundaryReport[] = []
    private invariantResults: InvariantViolationResult[] = []
    private memoryTrends: MemoryTrend[] = []

    addDeterminismProof(proof: DeterminismProof): void {
        this.determinismProofs.push(proof)
    }

    addReplayComparison(comparison: ReplayComparison): void {
        this.replayComparisons.push(comparison)
    }

    addStressResult(result: StressResult): void {
        this.stressResults.push(result)
    }

    addFaultOutcomes(outcomes: FaultOutcome[]): void {
        this.faultOutcomes.push(...outcomes)
    }

    addLegacyReport(report: LegacyBoundaryReport): void {
        this.legacyReports.push(report)
    }

    addInvariantResults(results: InvariantViolationResult[]): void {
        this.invariantResults.push(...results)
    }

    addMemoryTrend(trend: MemoryTrend): void {
        this.memoryTrends.push(trend)
    }

    generateReport(): OperationalTruthReport {
        const deterministic = this.determinismProofs.every(p => p.overallDeterministic)
        const replaySafe = this.replayComparisons.every(c => c.matches)
        const concurrencySafe = this.stressResults.every(r => r.invariantViolations.length === 0 && r.duplicateCommitsSucceeded === 0)
        const idempotent = this.faultOutcomes.every(f => f.retrySafe)
        const legacyIsolated = this.legacyReports.every(r => r.overallPassed)
        const invariantsEnforced = this.invariantResults.every(r => r.caught && r.safeAbort)

        const productionReady = deterministic && replaySafe && concurrencySafe &&
            idempotent && legacyIsolated && invariantsEnforced &&
            !this.memoryTrends.some(t => t.memoryLeakDetected)

        const determinismVerified = this.determinismProofs.reduce((acc, p) =>
            acc + p.claims.filter(c => c.verified).length, 0)
        const determinismTotal = this.determinismProofs.reduce((acc, p) =>
            acc + p.claims.length, 0)
        const determinismFailures = this.determinismProofs
            .filter(p => !p.overallDeterministic)
            .map(p => `${p.command}: ${p.divergenceCount} divergencies`)

        const replayMatches = this.replayComparisons.filter(c => c.matches).length
        const replayDivergenceDetails = this.replayComparisons
            .filter(c => !c.matches)
            .flatMap(c => c.differences.map(d => `[${d.severity}] ${d.field}: ${d.original} vs ${d.replay}`))

        const totalExecutions = this.stressResults.reduce((acc, r) => acc + r.totalExecutions, 0)
        const totalFailures = this.stressResults.reduce((acc, r) => acc + r.failedExecutions, 0)
        const totalDuplicateCommits = this.stressResults.reduce((acc, r) => acc + r.duplicateCommitsSucceeded, 0)
        const totalMiddlewareVetoes = this.stressResults.reduce((acc, r) => acc + r.middlewareVetoes, 0)
        const totalTransportFailures = this.stressResults.reduce((acc, r) => acc + r.transportFailures, 0)
        const allInvariantViolations = [...new Set(this.stressResults.flatMap(r => r.invariantViolations))]

        const faultsWithstood = this.faultOutcomes.filter(f => f.retrySafe).length
        const unsafeFaults = this.faultOutcomes.filter(f => !f.retrySafe).length
        const failureDetails = this.faultOutcomes
            .filter(f => !f.retrySafe)
            .map(f => `${f.faultType}: ${f.error}`)

        const invariantTestsRun = this.invariantResults.length
        const invariantPassed = this.invariantResults.filter(r => r.caught && r.safeAbort).length
        const invariantFailed = this.invariantResults.filter(r => !r.caught || !r.safeAbort).length
        const invariantFailures = this.invariantResults
            .filter(r => !r.caught || !r.safeAbort)
            .map(r => `${r.type}: ${r.errorMessage}`)

        const leakDetected = this.memoryTrends.some(t => t.memoryLeakDetected)
        const memoryIssues: string[] = []
        if (leakDetected) {
            for (const trend of this.memoryTrends) {
                if (trend.memoryLeakDetected) {
                    if (trend.activeTransactionGrowth > 0) {
                        memoryIssues.push(`Transaction leak: +${trend.activeTransactionGrowth}`)
                    }
                    if (trend.auditLogGrowth > 0) {
                        memoryIssues.push(`Audit log growth: +${trend.auditLogGrowth}`)
                    }
                    if (trend.commitRegistryGrowth > 0) {
                        memoryIssues.push(`Commit registry growth: +${trend.commitRegistryGrowth}`)
                    }
                    if (trend.snapshotGrowth > 0) {
                        memoryIssues.push(`Snapshot growth: +${trend.snapshotGrowth}`)
                    }
                }
            }
        }

        const blockers: string[] = []
        const experimentalFeatures: string[] = []

        if (!deterministic) blockers.push('Determinism not verified')
        if (!replaySafe) blockers.push('Replay divergence detected')
        if (!concurrencySafe) blockers.push('Concurrency safety issues')
        if (!idempotent) blockers.push('Idempotency not guaranteed')
        if (!legacyIsolated) blockers.push('Legacy isolation issues')
        if (!invariantsEnforced) blockers.push('Invariant enforcement incomplete')
        if (leakDetected) blockers.push('Memory leaks detected')

        if (!deterministic) experimentalFeatures.push('State hash determinism')
        if (!replaySafe) experimentalFeatures.push('Replay consistency')
        if (!idempotent) experimentalFeatures.push('Transport fault tolerance')

        return {
            generatedAt: Date.now(),
            summary: {
                deterministic,
                replaySafe,
                concurrencySafe,
                idempotent,
                legacyIsolated,
                invariantsEnforced,
                productionReady
            },
            determinism: {
                verified: determinismVerified,
                total: determinismTotal,
                divergent: this.determinismProofs.filter(p => p.divergenceCount > 0).length,
                failures: determinismFailures
            },
            replay: {
                comparisonsRun: this.replayComparisons.length,
                matches: replayMatches,
                divergences: this.replayComparisons.length - replayMatches,
                divergenceDetails: replayDivergenceDetails
            },
            concurrency: {
                stressTestsRun: this.stressResults.length,
                totalExecutions,
                failures: totalFailures,
                duplicateCommits: totalDuplicateCommits,
                middlewareVetoes: totalMiddlewareVetoes,
                transportFailures: totalTransportFailures,
                invariantViolations: allInvariantViolations
            },
            idempotency: {
                faultsInjected: this.faultOutcomes.length,
                faultsWithstood,
                unsafeFaults,
                failureDetails
            },
            legacyIsolation: {
                dispatcherOnlyPassed: this.legacyReports.every(r => r.dispatcherOnlyMode.failed === 0),
                hybridPassed: this.legacyReports.every(r => r.hybridMode.failed === 0),
                legacyOnlyPassed: this.legacyReports.every(r => r.legacyOnlyMode.failed === 0),
                leaks: this.legacyReports.flatMap(r => r.criticalIssues)
            },
            invariants: {
                testsRun: invariantTestsRun,
                passed: invariantPassed,
                failed: invariantFailed,
                failures: invariantFailures
            },
            memory: {
                leakDetected,
                trends: this.memoryTrends.length > 0 ? this.memoryTrends[this.memoryTrends.length - 1] : null,
                issues: memoryIssues
            },
            productionReadiness: {
                ready: productionReady,
                blockers,
                experimentalFeatures
            }
        }
    }

    printReport(report: OperationalTruthReport): string {
        const lines: string[] = []

        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('           OPERATIONAL TRUTH REPORT')
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push(`Generated: ${new Date(report.generatedAt).toISOString()}`)
        lines.push('')

        lines.push('─────────────────── SUMMARY ───────────────────')
        lines.push(`Deterministic:      ${this.bool(report.summary.deterministic)}`)
        lines.push(`Replay Safe:        ${this.bool(report.summary.replaySafe)}`)
        lines.push(`Concurrency Safe:  ${this.bool(report.summary.concurrencySafe)}`)
        lines.push(`Idempotent:         ${this.bool(report.summary.idempotent)}`)
        lines.push(`Legacy Isolated:    ${this.bool(report.summary.legacyIsolated)}`)
        lines.push(`Invariants Enforced: ${this.bool(report.summary.invariantsEnforced)}`)
        lines.push('')
        lines.push(`PRODUCTION READY: ${report.summary.productionReady ? 'YES' : 'NO'}`)
        lines.push('')

        lines.push('─────────────────── DETERMINISM ───────────────────')
        lines.push(`Verified: ${report.determinism.verified}/${report.determinism.total}`)
        lines.push(`Divergent: ${report.determinism.divergent}`)
        if (report.determinism.failures.length > 0) {
            lines.push('Failures:')
            for (const f of report.determinism.failures) {
                lines.push(`  - ${f}`)
            }
        }
        lines.push('')

        lines.push('─────────────────── REPLAY ───────────────────')
        lines.push(`Comparisons: ${report.replay.comparisonsRun}`)
        lines.push(`Matches: ${report.replay.matches}`)
        lines.push(`Divergences: ${report.replay.divergences}`)
        if (report.replay.divergenceDetails.length > 0) {
            lines.push('Divergence Details:')
            for (const d of report.replay.divergenceDetails.slice(0, 5)) {
                lines.push(`  - ${d}`)
            }
        }
        lines.push('')

        lines.push('─────────────────── CONCURRENCY ───────────────────')
        lines.push(`Total Executions: ${report.concurrency.totalExecutions}`)
        lines.push(`Failures: ${report.concurrency.failures}`)
        lines.push(`Duplicate Commits: ${report.concurrency.duplicateCommits}`)
        lines.push(`Middleware Vetoes: ${report.concurrency.middlewareVetoes}`)
        lines.push(`Transport Failures: ${report.concurrency.transportFailures}`)
        if (report.concurrency.invariantViolations.length > 0) {
            lines.push('Invariant Violations:')
            for (const v of report.concurrency.invariantViolations) {
                lines.push(`  - ${v}`)
            }
        }
        lines.push('')

        lines.push('─────────────────── IDEMPOTENCY ───────────────────')
        lines.push(`Faults Injected: ${report.idempotency.faultsInjected}`)
        lines.push(`Withstood: ${report.idempotency.faultsWithstood}`)
        lines.push(`Unsafe: ${report.idempotency.unsafeFaults}`)
        if (report.idempotency.failureDetails.length > 0) {
            lines.push('Failures:')
            for (const f of report.idempotency.failureDetails) {
                lines.push(`  - ${f}`)
            }
        }
        lines.push('')

        lines.push('─────────────────── LEGACY ISOLATION ───────────────────')
        lines.push(`Dispatcher Only: ${this.bool(report.legacyIsolation.dispatcherOnlyPassed)}`)
        lines.push(`Hybrid: ${this.bool(report.legacyIsolation.hybridPassed)}`)
        lines.push(`Legacy Only: ${this.bool(report.legacyIsolation.legacyOnlyPassed)}`)
        if (report.legacyIsolation.leaks.length > 0) {
            lines.push('Leaks:')
            for (const l of report.legacyIsolation.leaks) {
                lines.push(`  - ${l}`)
            }
        }
        lines.push('')

        lines.push('─────────────────── INVARIANTS ───────────────────')
        lines.push(`Tests Run: ${report.invariants.testsRun}`)
        lines.push(`Passed: ${report.invariants.passed}`)
        lines.push(`Failed: ${report.invariants.failed}`)
        if (report.invariants.failures.length > 0) {
            lines.push('Failures:')
            for (const f of report.invariants.failures) {
                lines.push(`  - ${f}`)
            }
        }
        lines.push('')

        lines.push('─────────────────── MEMORY ───────────────────')
        lines.push(`Leak Detected: ${this.bool(report.memory.leakDetected)}`)
        if (report.memory.issues.length > 0) {
            lines.push('Issues:')
            for (const i of report.memory.issues) {
                lines.push(`  - ${i}`)
            }
        }
        lines.push('')

        lines.push('─────────────────── PRODUCTION ───────────────────')
        if (report.productionReadiness.blockers.length > 0) {
            lines.push('Blockers:')
            for (const b of report.productionReadiness.blockers) {
                lines.push(`  - ${b}`)
            }
        }
        if (report.productionReadiness.experimentalFeatures.length > 0) {
            lines.push('Experimental:')
            for (const e of report.productionReadiness.experimentalFeatures) {
                lines.push(`  - ${e}`)
            }
        }
        lines.push('')

        lines.push('═══════════════════════════════════════════════════════════════')

        return lines.join('\n')
    }

    private bool(value: boolean): string {
        return value ? '✓ YES' : '✗ NO'
    }

    reset(): void {
        this.determinismProofs = []
        this.replayComparisons = []
        this.stressResults = []
        this.faultOutcomes = []
        this.legacyReports = []
        this.invariantResults = []
        this.memoryTrends = []
    }
}

export function createOperationalVerification(): {
    reporter: OperationalTruthReporter
    runFullVerification: () => Promise<OperationalTruthReport>
} {
    const reporter = new OperationalTruthReporter()

    const runFullVerification = async (): Promise<OperationalTruthReport> => {
        reporter.reset()

        return reporter.generateReport()
    }

    return { reporter, runFullVerification }
}