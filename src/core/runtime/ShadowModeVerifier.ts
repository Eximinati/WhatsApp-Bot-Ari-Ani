import type { NormalizedMessage } from '../serializer/types.js'
import type { ExecutionResult } from '../execution/ExecutionCoordinator.js'
import { RuntimeMode } from '../kernel/RuntimeKernel.js'

export type DivergenceSeverity = 'critical' | 'warning' | 'cosmetic'
export type DivergenceClassification =
    | 'SUCCESS_MISMATCH'
    | 'INTENT_COUNT_MISMATCH'
    | 'INTENT_PAYLOAD_MISMATCH'
    | 'STATE_HASH_MISMATCH'
    | 'EXECUTION_DURATION_MISMATCH'
    | 'ERROR_TYPE_MISMATCH'
    | 'PHASE_TRANSITION_MISMATCH'
    | 'NONE'

export interface DivergenceDetail {
    classification: DivergenceClassification
    severity: DivergenceSeverity
    field: string
    kernelValue: string
    legacyValue: string
    description: string
}

export interface DualExecutionResult {
    executionId: string
    command: string
    kernelResult: ExecutionResult | null
    legacyResult: LegacySimulatedResult | null
    divergences: DivergenceDetail[]
    overallDivergenceSeverity: DivergenceSeverity | 'none'
    executionDurationMs: { kernel: number; legacy: number }
    timestamp: number
}

export interface LegacySimulatedResult {
    success: boolean
    intents: { type: string; sequence: number }[]
    hash: string
    phase: string
    error?: string
}

export interface ShadowComparison {
    executionId: string
    command: string
    kernelResult: ExecutionResult | null
    legacyResult: LegacySimulatedResult | null
    diverged: boolean
    divergenceDetails: string[]
    timestamp: number
}

export interface ConfidenceScore {
    command: string
    score: number
    confidenceLevel: 'high' | 'medium' | 'low'
    factors: { factor: string; contribution: number; description: string }[]
    shadowTestsRun: number
    divergenceRate: number
    recommendation: 'promote' | 'continue_shadow' | 'rollback' | 'none'
}

export interface ShadowModeConfig {
    enableDualExecution: boolean
    divergenceThreshold: number
    autoPromoteOnConvergence: boolean
    convergenceWindow: number
    maxShadowExecutions: number
    comparePayloads: boolean
    compareHashes: boolean
    compareDuration: boolean
    classifyDivergences: boolean
}

export class ShadowModeVerifier {
    private comparisons: ShadowComparison[] = []
    private dualResults: DualExecutionResult[] = []
    private kernelOnlyMode = false
    private legacyOnlyMode = false
    private confidenceScores: Map<string, ConfidenceScore> = new Map()
    private config: ShadowModeConfig = {
        enableDualExecution: true,
        divergenceThreshold: 0.05,
        autoPromoteOnConvergence: false,
        convergenceWindow: 10,
        maxShadowExecutions: 100,
        comparePayloads: true,
        compareHashes: true,
        compareDuration: true,
        classifyDivergences: true
    }

    setModes(kernelOnly: boolean, legacyOnly: boolean): void {
        this.kernelOnlyMode = kernelOnly
        this.legacyOnlyMode = legacyOnly
    }

    setConfig(config: Partial<ShadowModeConfig>): void {
        this.config = { ...this.config, ...config }
    }

    recordKernelExecution(executionId: string, command: string, result: ExecutionResult | null): void {
        const comparison: ShadowComparison = {
            executionId,
            command,
            kernelResult: result,
            legacyResult: null,
            diverged: false,
            divergenceDetails: [],
            timestamp: Date.now()
        }

        if (this.legacyOnlyMode) {
            comparison.divergenceDetails.push('Legacy-only mode - kernel not executed')
            comparison.diverged = true
        }

        this.comparisons.push(comparison)
    }

    recordLegacyExecution(executionId: string, result: unknown): void {
        const comparison = this.comparisons.find(c => c.executionId === executionId)
        if (comparison) {
            comparison.legacyResult = result as LegacySimulatedResult

            if (comparison.kernelResult) {
                const kernel = comparison.kernelResult

                if (kernel.success !== (result && typeof result === 'object' && 'success' in result ? (result as any).success : false)) {
                    comparison.divergenceDetails.push(`Success mismatch: kernel=${kernel.success}, legacy=${result}`)
                    comparison.diverged = true
                }

                if (kernel.intents.length !== (result && typeof result === 'object' && 'intents' in result ? (result as any).intents?.length : 0)) {
                    comparison.divergenceDetails.push(`Intents count mismatch: kernel=${kernel.intents.length}, legacy=${(result as any)?.intents?.length}`)
                    comparison.diverged = true
                }

                if (kernel.finalStateHash !== (result && typeof result === 'object' && 'hash' in result ? (result as any).hash : '')) {
                    comparison.divergenceDetails.push(`State hash mismatch: kernel=${kernel.finalStateHash}, legacy=${(result as any)?.hash}`)
                    comparison.diverged = true
                }
            }
        }
    }

    executeDual(
        executionId: string,
        command: string,
        kernelFn: () => Promise<ExecutionResult>,
        legacyFn: () => Promise<LegacySimulatedResult>
    ): Promise<DualExecutionResult> {
        const kernelStart = Date.now()
        const kernelResultPromise = kernelFn()

        const legacyStart = Date.now()
        const legacyResultPromise = legacyFn()

        let kernelResult: ExecutionResult | null = null
        let legacyResult: LegacySimulatedResult | null = null
        let kernelDuration = 0
        let legacyDuration = 0

        kernelResultPromise.then(r => {
            kernelResult = r
            kernelDuration = Date.now() - kernelStart
        }).catch(() => {})

        legacyResultPromise.then(r => {
            legacyResult = r
            legacyDuration = Date.now() - legacyStart
        }).catch(() => {})

        return Promise.all([kernelResultPromise, legacyResultPromise]).then(async () => {
            const kResult = await kernelResultPromise.catch(() => null)
            const lResult = await legacyResultPromise.catch(() => null)

            kernelResult = kResult
            legacyResult = lResult
            kernelDuration = Date.now() - kernelStart
            legacyDuration = Date.now() - legacyStart

            const divergences = this.compareResults(kernelResult, legacyResult)
            const maxSeverity = this.getMaxDivergenceSeverity(divergences)

            const dualResult: DualExecutionResult = {
                executionId,
                command,
                kernelResult,
                legacyResult,
                divergences,
                overallDivergenceSeverity: maxSeverity,
                executionDurationMs: { kernel: kernelDuration, legacy: legacyDuration },
                timestamp: Date.now()
            }

            this.dualResults.push(dualResult)
            this.updateConfidenceScore(command, divergences)

            return dualResult
        })
    }

    private compareResults(kernel: ExecutionResult | null, legacy: LegacySimulatedResult | null): DivergenceDetail[] {
        const divergences: DivergenceDetail[] = []

        if (!kernel && !legacy) return divergences

        const k = kernel
        const l = legacy

        if (!k && l) {
            divergences.push({
                classification: 'NONE',
                severity: 'critical',
                field: 'execution',
                kernelValue: 'null',
                legacyValue: 'executed',
                description: 'Kernel failed but legacy succeeded'
            })
            return divergences
        }

        if (k && !l) {
            divergences.push({
                classification: 'NONE',
                severity: 'warning',
                field: 'execution',
                kernelValue: 'executed',
                legacyValue: 'null',
                description: 'Legacy failed but kernel succeeded'
            })
            return divergences
        }

        if (!k || !l) return divergences

        if (k.success !== l.success) {
            divergences.push({
                classification: 'SUCCESS_MISMATCH',
                severity: 'critical',
                field: 'success',
                kernelValue: String(k.success),
                legacyValue: String(l.success),
                description: 'Success state differs between kernel and legacy'
            })
        }

        if (k.intents.length !== l.intents.length) {
            divergences.push({
                classification: 'INTENT_COUNT_MISMATCH',
                severity: 'warning',
                field: 'intents.length',
                kernelValue: String(k.intents.length),
                legacyValue: String(l.intents.length),
                description: 'Intent count differs between kernel and legacy'
            })
        }

        if (k.intents.length === l.intents.length && this.config.comparePayloads) {
            for (let i = 0; i < k.intents.length; i++) {
                const kIntent = k.intents[i]
                const lIntent = l.intents[i]
                if (kIntent.type !== lIntent.type) {
                    divergences.push({
                        classification: 'INTENT_PAYLOAD_MISMATCH',
                        severity: 'warning',
                        field: `intents[${i}].type`,
                        kernelValue: kIntent.type,
                        legacyValue: lIntent.type,
                        description: `Intent type mismatch at index ${i}`
                    })
                }
            }
        }

        if (this.config.compareHashes && k.finalStateHash !== l.hash) {
            divergences.push({
                classification: 'STATE_HASH_MISMATCH',
                severity: 'warning',
                field: 'finalStateHash',
                kernelValue: k.finalStateHash,
                legacyValue: l.hash,
                description: 'Final state hash differs between kernel and legacy'
            })
        }

        if (this.config.compareDuration) {
            const kDuration = k.durationMs
            const lDuration = l.error ? 0 : kDuration
            const diff = Math.abs(kDuration - lDuration)
            const pct = kDuration > 0 ? diff / kDuration : 0
            if (pct > 0.5) {
                divergences.push({
                    classification: 'EXECUTION_DURATION_MISMATCH',
                    severity: 'cosmetic',
                    field: 'durationMs',
                    kernelValue: String(kDuration),
                    legacyValue: String(lDuration),
                    description: `Execution duration differs by ${pct.toFixed(1)}%`
                })
            }
        }

        if (k.phase !== l.phase) {
            divergences.push({
                classification: 'PHASE_TRANSITION_MISMATCH',
                severity: 'warning',
                field: 'phase',
                kernelValue: k.phase,
                legacyValue: l.phase,
                description: 'Final execution phase differs between kernel and legacy'
            })
        }

        const kernelError = k.error?.name || ''
        const legacyError = l.error || ''
        if ((kernelError && !legacyError) || (!kernelError && legacyError)) {
            divergences.push({
                classification: 'ERROR_TYPE_MISMATCH',
                severity: 'warning',
                field: 'error',
                kernelValue: kernelError || 'none',
                legacyValue: legacyError || 'none',
                description: 'Error presence differs between kernel and legacy'
            })
        }

        return divergences
    }

    private getMaxDivergenceSeverity(divergences: DivergenceDetail[]): DivergenceSeverity | 'none' {
        if (divergences.length === 0) return 'none'
        if (divergences.some(d => d.severity === 'critical')) return 'critical'
        if (divergences.some(d => d.severity === 'warning')) return 'warning'
        return 'cosmetic'
    }

    private updateConfidenceScore(command: string, divergences: DivergenceDetail[]): void {
        const existing = this.confidenceScores.get(command) || {
            command,
            score: 1.0,
            confidenceLevel: 'high' as const,
            factors: [],
            shadowTestsRun: 0,
            divergenceRate: 0,
            recommendation: 'none' as const
        }

        existing.shadowTestsRun++

        const criticalDivs = divergences.filter(d => d.severity === 'critical').length
        const warningDivs = divergences.filter(d => d.severity === 'warning').length
        const cosmeticDivs = divergences.filter(d => d.severity === 'cosmetic').length

        existing.divergenceRate = (criticalDivs * 1.0 + warningDivs * 0.5 + cosmeticDivs * 0.1) / existing.shadowTestsRun

        const penalty = criticalDivs * 0.3 + warningDivs * 0.1 + cosmeticDivs * 0.02
        existing.score = Math.max(0, existing.score - penalty)

        if (existing.score >= 0.8) existing.confidenceLevel = 'high'
        else if (existing.score >= 0.5) existing.confidenceLevel = 'medium'
        else existing.confidenceLevel = 'low'

        existing.factors = [
            { factor: 'shadowTestsRun', contribution: Math.min(0.1, existing.shadowTestsRun * 0.01), description: 'More shadow tests increase confidence' },
            { factor: 'criticalDivergences', contribution: -criticalDivs * 0.3, description: 'Critical divergences reduce confidence' },
            { factor: 'warningDivergences', contribution: -warningDivs * 0.1, description: 'Warning divergences reduce confidence' },
            { factor: 'cosmeticDivergences', contribution: -cosmeticDivs * 0.02, description: 'Cosmetic divergences slightly reduce confidence' },
            { factor: 'divergenceRate', contribution: -existing.divergenceRate * 0.5, description: 'Higher divergence rate reduces confidence' }
        ]

        if (existing.score >= 0.9 && existing.shadowTestsRun >= this.config.convergenceWindow) {
            existing.recommendation = 'promote'
        } else if (existing.score >= 0.5) {
            existing.recommendation = 'continue_shadow'
        } else if (existing.score < 0.3) {
            existing.recommendation = 'rollback'
        } else {
            existing.recommendation = 'continue_shadow'
        }

        this.confidenceScores.set(command, existing)
    }

    getDivergenceCount(): number {
        return this.comparisons.filter(c => c.diverged).length
    }

    getTotalComparisons(): number {
        return this.comparisons.length
    }

    getDivergenceRate(): number {
        if (this.comparisons.length === 0) return 0
        return this.getDivergenceCount() / this.comparisons.length
    }

    getDualDivergenceRate(): number {
        if (this.dualResults.length === 0) return 0
        const diverged = this.dualResults.filter(r => r.overallDivergenceSeverity !== 'none').length
        return diverged / this.dualResults.length
    }

    getDivergences(): ShadowComparison[] {
        return this.comparisons.filter(c => c.diverged)
    }

    getConfidenceScore(command: string): ConfidenceScore | undefined {
        return this.confidenceScores.get(command)
    }

    getAllConfidenceScores(): Map<string, ConfidenceScore> {
        return new Map(this.confidenceScores)
    }

    getPromotionRecommendations(): { command: string; recommendation: 'promote' | 'continue_shadow' | 'rollback' | 'none'; score: number }[] {
        const recs: { command: string; recommendation: 'promote' | 'continue_shadow' | 'rollback' | 'none'; score: number }[] = []
        for (const [command, score] of this.confidenceScores) {
            recs.push({ command, recommendation: score.recommendation, score: score.score })
        }
        return recs.sort((a, b) => b.score - a.score)
    }

    generateReport(): string {
        const total = this.getTotalComparisons()
        const diverged = this.getDivergenceCount()
        const rate = (this.getDivergenceRate() * 100).toFixed(2)

        const lines: string[] = []
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('                    SHADOW MODE VERIFICATION REPORT')
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('')
        lines.push(`Mode: ${this.kernelOnlyMode ? 'Kernel-Only' : this.legacyOnlyMode ? 'Legacy-Only' : 'Dual (Shadow)'}`)
        lines.push(`Total Comparisons: ${total}`)
        lines.push(`Divergences: ${diverged}`)
        lines.push(`Divergence Rate: ${rate}%`)
        lines.push('')

        if (this.dualResults.length > 0) {
            lines.push('─────────────────── DUAL EXECUTION RESULTS ───────────────────')
            lines.push(`Dual Executions Run: ${this.dualResults.length}`)
            const criticalDivs = this.dualResults.filter(r => r.overallDivergenceSeverity === 'critical').length
            const warningDivs = this.dualResults.filter(r => r.overallDivergenceSeverity === 'warning').length
            const cosmeticDivs = this.dualResults.filter(r => r.overallDivergenceSeverity === 'cosmetic').length
            lines.push(`  Critical: ${criticalDivs}`)
            lines.push(`  Warning: ${warningDivs}`)
            lines.push(`  Cosmetic: ${cosmeticDivs}`)
            lines.push(`Dual Divergence Rate: ${(this.getDualDivergenceRate() * 100).toFixed(2)}%`)
            lines.push('')
        }

        if (this.confidenceScores.size > 0) {
            lines.push('─────────────────── CONFIDENCE SCORES ───────────────────')
            for (const [command, score] of this.confidenceScores) {
                lines.push(`Command: ${command}`)
                lines.push(`  Score: ${(score.score * 100).toFixed(1)}% (${score.confidenceLevel})`)
                lines.push(`  Shadow Tests: ${score.shadowTestsRun}`)
                lines.push(`  Divergence Rate: ${score.divergenceRate.toFixed(3)}`)
                lines.push(`  Recommendation: ${score.recommendation}`)
                lines.push('')
            }
        }

        if (diverged > 0) {
            lines.push('─────────────────── DIVERGENCE DETAILS ───────────────────')
            for (const d of this.getDivergences().slice(0, 10)) {
                lines.push(`Command: ${d.command}`)
                lines.push(`Execution: ${d.executionId}`)
                for (const detail of d.divergenceDetails) {
                    lines.push(`  - ${detail}`)
                }
                lines.push('')
            }
        }

        lines.push('═══════════════════════════════════════════════════════════════')

        return lines.join('\n')
    }

    generateDualExecutionReport(): string {
        const lines: string[] = []
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('               DUAL EXECUTION SHADOW MODE REPORT')
        lines.push('═══════════════════════════════════════════════════════════════')
        lines.push('')

        const promotions = this.getPromotionRecommendations().filter(r => r.recommendation === 'promote')
        const rollbacks = this.getPromotionRecommendations().filter(r => r.recommendation === 'rollback')
        const continueShadow = this.getPromotionRecommendations().filter(r => r.recommendation === 'continue_shadow')

        lines.push(`Total Commands: ${this.confidenceScores.size}`)
        lines.push(`Ready for Promotion: ${promotions.length}`)
        lines.push(`Requires Rollback: ${rollbacks.length}`)
        lines.push(`Continue Shadow Testing: ${continueShadow.length}`)
        lines.push('')

        if (promotions.length > 0) {
            lines.push('─────────────────── PROMOTION READY ───────────────────')
            for (const p of promotions) {
                lines.push(`  ${p.command}: ${(p.score * 100).toFixed(1)}% confidence`)
            }
            lines.push('')
        }

        if (rollbacks.length > 0) {
            lines.push('─────────────────── ROLLBACK REQUIRED ───────────────────')
            for (const r of rollbacks) {
                lines.push(`  ${r.command}: ${(r.score * 100).toFixed(1)}% confidence`)
            }
            lines.push('')
        }

        lines.push('─────────────────── DUAL EXECUTION DETAILS ───────────────────')
        for (const result of this.dualResults.slice(-20)) {
            const divCount = result.divergences.length
            lines.push(`${result.executionId} [${result.command}]`)
            lines.push(`  Severity: ${result.overallDivergenceSeverity}`)
            lines.push(`  Divergences: ${divCount}`)
            lines.push(`  Kernel Duration: ${result.executionDurationMs.kernel}ms`)
            lines.push(`  Legacy Duration: ${result.executionDurationMs.legacy}ms`)
        }

        lines.push('')
        lines.push('═══════════════════════════════════════════════════════════════')

        return lines.join('\n')
    }

    reset(): void {
        this.comparisons = []
        this.dualResults = []
        this.confidenceScores.clear()
    }
}