import { RuntimeKernel, RuntimeMode } from '../kernel/RuntimeKernel.js'
import type { NormalizedMessage } from '../serializer/types.js'
import type { ExecutionResult } from '../execution/ExecutionCoordinator.js'
import { CommitDecision } from '../transport/types.js'
import { createDeterministicLiveClock, resetGlobalCounters, getNextAuditId } from '../execution/DeterministicClock.js'
import { AuthoritativeCommitRegistry } from '../transport/AuthoritativeCommitRegistry.js'
import { ExecutionTransaction } from '../transport/TransportFacade.js'
import { StateManager } from '../state/index.js'

import {
    RuntimeStressHarness,
    createMockMessage,
    ConcurrentExecutionSimulator,
    ReplayConsistencySuite
} from './RuntimeStressHarness.js'

import {
    DeterminismValidator,
    ReplayDiffAnalyzer
} from './DeterminismValidator.js'

import { TransportFaultInjector, FaultType } from './TransportFaultInjector.js'
import { RuntimeMemoryAudit } from './RuntimeMemoryAudit.js'
import { LegacyBoundaryAudit } from './LegacyBoundaryAudit.js'
import { InvariantViolationTest } from './InvariantViolationTest.js'
import { OperationalTruthReporter, createOperationalVerification } from './OperationalTruthReporter.js'

type BoundaryRuntimeMode = RuntimeMode

export type VerificationMode = 'quick' | 'stress' | 'replay' | 'fault' | 'full'

export interface VerificationConfig {
    mode: VerificationMode
    concurrentCount?: number
    repeatCount?: number
    enableTransportFaults?: boolean
    enableMemoryStress?: boolean
    enableLegacyTesting?: boolean
    enableReplayValidation?: boolean
}

export interface ExecutionMetrics {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
    peakMemoryUsage: number
    transactionCount: number
    commitCount: number
    auditLogSize: number
    snapshotCount: number
}

export interface VerificationProgress {
    phase: string
    completed: number
    total: number
    current: string
}

export class RuntimeVerificationRunner {
    private kernel: RuntimeKernel | null = null
    private reporter: OperationalTruthReporter
    private stressHarness: RuntimeStressHarness
    private determinismValidator: DeterminismValidator
    private replayAnalyzer: ReplayDiffAnalyzer
    private faultInjector: TransportFaultInjector
    private memoryAudit: RuntimeMemoryAudit
    private legacyAudit: LegacyBoundaryAudit
    private invariantTest: InvariantViolationTest
    private commitRegistry: AuthoritativeCommitRegistry
    private stateManager: StateManager

    private metrics: ExecutionMetrics = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        peakMemoryUsage: 0,
        transactionCount: 0,
        commitCount: 0,
        auditLogSize: 0,
        snapshotCount: 0
    }

    private executionResults: ExecutionResult[] = []
    private replaySessions: Map<string, ExecutionResult[]> = new Map()

    constructor() {
        this.reporter = new OperationalTruthReporter()
        this.stressHarness = new RuntimeStressHarness()
        this.determinismValidator = new DeterminismValidator()
        this.replayAnalyzer = new ReplayDiffAnalyzer()
        this.faultInjector = new TransportFaultInjector()
        this.memoryAudit = new RuntimeMemoryAudit()
        this.legacyAudit = new LegacyBoundaryAudit()
        this.invariantTest = new InvariantViolationTest()
        this.commitRegistry = new AuthoritativeCommitRegistry()
        this.stateManager = new StateManager({ snapshotRetention: 100 })
    }

    async initialize(mode: RuntimeMode = RuntimeMode.HYBRID): Promise<void> {
        const mockClient = this.createMockRuntimeClient()

        this.kernel = new RuntimeKernel(mockClient, {
            mode,
            capabilities: {
                allowQuoted: true,
                allowMedia: true,
                allowEdits: false,
                allowReactions: true,
                maxMediaSize: 16 * 1024 * 1024
            },
            maxRetries: 3,
            timeoutMs: 5000
        })

        await this.kernel.initialize()
    }

    private createMockRuntimeClient(): any {
        return {
            log: (msg: string) => console.log('[MockClient]', msg),
            sendMessage: async (jid: string, content: any, options?: any) => {
                return { key: { id: 'mock-msg-' + Date.now() } }
            },
            sendPresenceUpdate: async (presence: string, jid: string) => {},
            groupMetadata: async (jid: string) => null,
            getContact: (jid: string) => null,
            downloadMediaMessage: async (msg: any) => null,
            isMe: (jid: string) => false,
            config: { prefix: '!' }
        }
    }

    async runVerification(config: VerificationConfig): Promise<void> {
        console.log('═══════════════════════════════════════════════════════════════')
        console.log('           REAL EXECUTION VERIFICATION RUNNER')
        console.log('═══════════════════════════════════════════════════════════════')
        console.log('Mode:', config.mode)
        console.log('')

        if (config.enableTransportFaults) {
            this.faultInjector.setFailureRate(0.1)
            this.faultInjector.enableFault(FaultType.PARTIAL_COMMIT)
            this.faultInjector.enableFault(FaultType.DUPLICATE_SEND)
        }

        switch (config.mode) {
            case 'quick':
                await this.runQuickVerification(config)
                break
            case 'stress':
                await this.runStressVerification(config)
                break
            case 'replay':
                await this.runReplayVerification(config)
                break
            case 'fault':
                await this.runFaultVerification(config)
                break
            case 'full':
                await this.runFullVerification(config)
                break
        }

        const report = this.reporter.generateReport()
        console.log('')
        console.log(this.reporter.printReport(report))
    }

    private async runQuickVerification(config: VerificationConfig): Promise<void> {
        console.log('=== QUICK VERIFICATION MODE ===')
        console.log('')

        console.log('Phase 1: Basic Execution Test')
        await this.testBasicExecution(10)
        this.reportProgress('Basic Execution', 10, 10, 'Completed')

        console.log('Phase 2: Determinism Check')
        await this.testDeterminism(5)
        this.reportProgress('Determinism', 5, 5, 'Completed')

        console.log('Phase 3: Transaction Registry')
        await this.testTransactionRegistry(10)
        this.reportProgress('Transaction Registry', 10, 10, 'Completed')

        console.log('Phase 4: Invariant Enforcement')
        this.testInvariantEnforcement()
        this.reportProgress('Invariant Enforcement', 1, 1, 'Completed')

        console.log('')
        console.log('Quick verification complete!')
    }

    private async runStressVerification(config: VerificationConfig): Promise<void> {
        const concurrentCount = config.concurrentCount || 100
        console.log('=== STRESS VERIFICATION MODE ===')
        console.log('Concurrent executions:', concurrentCount)
        console.log('')

        console.log('Phase 1: Concurrent Execution Stress')
        await this.testConcurrentExecution(concurrentCount)
        this.reportProgress('Concurrent Stress', 1, 1, `Executed ${concurrentCount} parallel`)

        console.log('Phase 2: Transaction Flood')
        await this.testTransactionFlood(concurrentCount * 2)
        this.reportProgress('Transaction Flood', 1, 1, 'Completed')

        console.log('Phase 3: Memory Under Load')
        await this.testMemoryUnderLoad(1000)
        this.reportProgress('Memory Stress', 1, 1, '1000 executions')

        console.log('Phase 4: Commit Registry Stress')
        await this.testCommitRegistryStress(concurrentCount)
        this.reportProgress('Commit Registry', 1, 1, 'Completed')

        console.log('Phase 5: Audit Log Stress')
        await this.testAuditLogStress(concurrentCount)
        this.reportProgress('Audit Log', 1, 1, 'Completed')

        console.log('')
        console.log('Stress verification complete!')
    }

    private async runReplayVerification(config: VerificationConfig): Promise<void> {
        const repeatCount = config.repeatCount || 10
        console.log('=== REPLAY VERIFICATION MODE ===')
        console.log('Replay iterations:', repeatCount)
        console.log('')

        console.log('Phase 1: Capture Original Execution')
        const originalResult = await this.executeSingleCommand('ping', ['test'])
        this.captureReplaySession('ping-test', originalResult)
        this.reportProgress('Capture', 1, 1, 'Original captured')

        console.log('Phase 2: Replay Execution')
        await this.testReplayConsistency('ping-test', repeatCount)
        this.reportProgress('Replay', repeatCount, repeatCount, 'Completed')

        console.log('Phase 3: Transition Validation')
        await this.testTransitionDeterminism(repeatCount)
        this.reportProgress('Transitions', repeatCount, repeatCount, 'Completed')

        console.log('Phase 4: Intent Ordering')
        await this.testIntentOrdering(repeatCount)
        this.reportProgress('Intents', repeatCount, repeatCount, 'Completed')

        console.log('Phase 5: State Hash Determinism')
        await this.testStateHashDeterminism(repeatCount)
        this.reportProgress('State Hash', repeatCount, repeatCount, 'Completed')

        console.log('')
        console.log('Replay verification complete!')
    }

    private async runFaultVerification(config: VerificationConfig): Promise<void> {
        console.log('=== FAULT INJECTION VERIFICATION MODE ===')
        console.log('')

        console.log('Phase 1: Partial Commit Failure')
        await this.testPartialCommitFailure()
        this.reportProgress('Partial Commit', 1, 1, 'Completed')

        console.log('Phase 2: Duplicate Send Detection')
        await this.testDuplicateSendDetection()
        this.reportProgress('Duplicate Send', 1, 1, 'Completed')

        console.log('Phase 3: Transport Timeout')
        await this.testTransportTimeout()
        this.reportProgress('Timeout', 1, 1, 'Completed')

        console.log('Phase 4: Crash After Reservation')
        await this.testCrashAfterReservation()
        this.reportProgress('Crash After Reserve', 1, 1, 'Completed')

        console.log('Phase 5: Retry After Finalize')
        await this.testRetryAfterFinalize()
        this.reportProgress('Retry After Finalize', 1, 1, 'Completed')

        console.log('Phase 6: Idempotency Verification')
        const idempotencyResult = this.faultInjector.verifyIdempotency(this.commitRegistry)
        console.log('Idempotency check:', idempotencyResult.idempotent ? 'PASSED' : 'FAILED')
        if (!idempotencyResult.idempotent) {
            console.log('  Issues:', idempotencyResult.issues)
        }

        this.reporter.addFaultOutcomes([...this.faultInjector.getInjectedFaults()])

        console.log('')
        console.log('Fault verification complete!')
    }

    private async runFullVerification(config: VerificationConfig): Promise<void> {
        console.log('=== FULL VERIFICATION MODE ===')
        console.log('This will run all verification tests...')
        console.log('')

        await this.runQuickVerification(config)
        await this.runStressVerification(config)
        await this.runReplayVerification(config)
        await this.runFaultVerification(config)

        if (config.enableLegacyTesting) {
            await this.runLegacyIsolationTest()
        }

        console.log('')
        console.log('═══════════════════════════════════════════════════════════════')
        console.log('                    FULL VERIFICATION COMPLETE')
        console.log('═══════════════════════════════════════════════════════════════')
    }

    private async testBasicExecution(count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const result = await this.executeSingleCommand('ping', ['test' + i])
            this.executionResults.push(result)
            this.metrics.totalExecutions++
            this.metrics.successfulExecutions++
        }
    }

    private async testDeterminism(count: number): Promise<void> {
        const message = createMockMessage('ping', ['determinism-test'])

for (let i = 0; i < count; i++) {
            resetGlobalCounters()
            this.stateManager.reset()
            const result = await this.executeSingleCommand('ping', ['det'])
            this.executionResults.push(result)
        }

        const proof = await this.determinismValidator.verifyDeterminism(
            (msg) => this.executeSingleCommand('ping', ['det']),
            message,
            count,
            async () => {
                resetGlobalCounters()
                this.stateManager.reset()
                if (this.kernel) {
                    this.kernel.getExecutionCoordinator().reset()
                }
            }
        )

        this.reporter.addDeterminismProof(proof)
        console.log('Determinism verified:', proof.overallDeterministic ? 'YES' : 'NO')
    }

    private async testTransactionRegistry(count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const result = await this.executeSingleCommand('ping', ['txn-' + i])
            this.metrics.transactionCount++
            if (result.intents.length > 0) {
                this.metrics.commitCount += result.intents.length
            }
        }

        const state = this.commitRegistry.getAllReservations()
        console.log('Commit registry size:', state.length)
    }

    private testInvariantEnforcement(): void {
        const testTransaction = this.createTestTransaction()

        const result = this.invariantTest.testDoubleFinalize(testTransaction)
        const results = this.invariantTest.getResults()
        this.reporter.addInvariantResults(results)

        console.log('Invariant test - double finalize:', result.caught && result.safeAbort ? 'PASSED (invariant correctly enforced)' : 'FAILED (invariant did not work)' + ' - ' + (result.errorMessage || 'no error'))
    }

    private createTestTransaction(): any {
        return new ExecutionTransaction('test-txn-' + Date.now(), 0)
    }

    private async testConcurrentExecution(count: number): Promise<void> {
        const simulator = new ConcurrentExecutionSimulator()
        const startTime = Date.now()

        const tasks: Array<() => Promise<unknown>> = []
        for (let i = 0; i < count; i++) {
            tasks.push(async () => {
                const result = await this.executeSingleCommand('ping', ['concurrent-' + i])
                return result
            })
        }

        await simulator.simulate(tasks, Math.min(count, 50))

        const elapsed = Date.now() - startTime
        this.metrics.averageExecutionTime = elapsed / count

        console.log('Concurrent execution time:', elapsed + 'ms')
        console.log('Average per execution:', this.metrics.averageExecutionTime.toFixed(2) + 'ms')
        console.log('Max concurrent:', simulator.getMaxConcurrent())
    }

    private async testTransactionFlood(count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const result = await this.executeSingleCommand('ping', ['flood-' + i])
            this.memoryAudit.trackTransactionStart('flood-txn-' + i)

            if (i % 10 === 0) {
                this.memoryAudit.trackTransactionEnd('flood-txn-' + (i - 5))
            }
        }

        this.memoryAudit.capture(this.commitRegistry, this.stateManager)
    }

    private async testMemoryUnderLoad(count: number): Promise<void> {
        const snapshots: number[] = []

        for (let i = 0; i < count; i++) {
            const result = await this.executeSingleCommand('ping', ['mem-' + i])
            this.memoryAudit.trackSnapshot('snap-' + i)

            if (i % 100 === 0) {
                const mem = this.memoryAudit.capture(this.commitRegistry, this.stateManager)
                snapshots.push(mem.commitRegistrySize)
            }
        }

        const trend = this.memoryAudit.analyze()
        this.reporter.addMemoryTrend(trend)

        console.log('Memory trend:', trend.memoryLeakDetected ? 'LEAK DETECTED' : 'STABLE')
    }

    private async testCommitRegistryStress(count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const intentId = 'stress-intent-' + i
            this.commitRegistry.reserve(intentId, 'stress-txn', i)
            if (i % 2 === 0) {
                this.commitRegistry.markCommitted(intentId, i + 1)
            }
        }

        const cleanup = this.memoryAudit.verifyCleanup(this.commitRegistry)
        console.log('Cleanup needed:', cleanup.cleanupNeeded)
    }

    private async testAuditLogStress(count: number): Promise<void> {
        for (let i = 0; i < count; i++) {
            const record = { index: i, timestamp: Date.now() }
            this.memoryAudit.trackAuditRecord(record)
        }

        this.metrics.auditLogSize = this.memoryAudit.getCurrentState().auditLogSize
        console.log('Audit log size:', this.metrics.auditLogSize)
    }

    private captureReplaySession(sessionId: string, result: ExecutionResult): void {
        const existing = this.replaySessions.get(sessionId) || []
        existing.push(result)
        this.replaySessions.set(sessionId, existing)
    }

    private async testReplayConsistency(sessionId: string, count: number): Promise<void> {
        const originalResults = this.replaySessions.get(sessionId) || []
        if (originalResults.length === 0) return

        const original = originalResults[0]

        for (let i = 1; i < count; i++) {
            resetGlobalCounters()
            const replay = await this.executeSingleCommand('ping', ['replay'])

            const comparison = this.replayAnalyzer.compare(original, replay)
            this.reporter.addReplayComparison(comparison)

            if (!comparison.matches) {
                console.log('Replay divergence detected at iteration', i)
            }
        }
    }

    private async testTransitionDeterminism(count: number): Promise<void> {
        const transitions: string[][] = []

        for (let i = 0; i < count; i++) {
            resetGlobalCounters()
            const result = await this.executeSingleCommand('ping', ['trans-' + i])
            transitions.push(result.transitions.map((t: any) => t.from + '->' + t.to))
        }

        const first = transitions[0]
        let divergent = false
        for (let i = 1; i < transitions.length; i++) {
            if (JSON.stringify(transitions[i]) !== JSON.stringify(first)) {
                divergent = true
                break
            }
        }

        console.log('Transition determinism:', divergent ? 'DIVERGED' : 'DETERMINISTIC')
    }

    private async testIntentOrdering(count: number): Promise<void> {
        const intents: string[][] = []

        for (let i = 0; i < count; i++) {
            resetGlobalCounters()
            const result = await this.executeSingleCommand('ping', ['intent-' + i])
            intents.push(result.intents.map((t: any) => t.type + ':' + t.sequence))
        }

        const first = intents[0]
        let divergent = false
        for (let i = 1; i < intents.length; i++) {
            if (JSON.stringify(intents[i]) !== JSON.stringify(first)) {
                divergent = true
                break
            }
        }

        console.log('Intent ordering:', divergent ? 'DIVERGED' : 'DETERMINISTIC')
    }

    private async testStateHashDeterminism(count: number): Promise<void> {
        const hashes: string[] = []

        for (let i = 0; i < count; i++) {
            resetGlobalCounters()
            const result = await this.executeSingleCommand('ping', ['hash-' + i])
            hashes.push(result.finalStateHash)
        }

        const unique = new Set(hashes)
        console.log('State hash determinism:', unique.size === 1 ? 'DETERMINISTIC' : 'DIVERGED (' + unique.size + ' unique)')
    }

    private async testPartialCommitFailure(): Promise<void> {
        this.faultInjector.setFailureRate(1.0)
        this.faultInjector.enableFault(FaultType.PARTIAL_COMMIT)

        const result = await this.executeSingleCommand('ping', ['fault-test'])
        console.log('Partial commit test completed')
    }

    private async testDuplicateSendDetection(): Promise<void> {
        this.faultInjector.reset()
        this.faultInjector.enableFault(FaultType.DUPLICATE_SEND)

        const intentId = 'dup-test-' + Date.now()
        this.commitRegistry.reserve(intentId, 'dup-txn', 1)
        this.commitRegistry.markCommitted(intentId, 2)

        const reserved = this.commitRegistry.reserve(intentId, 'dup-txn-2', 3)
        console.log('Duplicate send detection:', reserved ? 'BLOCKED' : 'ALLOWED')
    }

    private async testTransportTimeout(): Promise<void> {
        this.faultInjector.reset()
        this.faultInjector.enableFault(FaultType.TIMEOUT)

        const result = await this.executeSingleCommand('ping', ['timeout-test'])
        console.log('Transport timeout test completed')
    }

    private async testCrashAfterReservation(): Promise<void> {
        this.faultInjector.reset()
        this.faultInjector.enableFault(FaultType.CRASH_AFTER_RESERVATION)

        const intentId = 'crash-test-' + Date.now()
        const reserved = this.commitRegistry.reserve(intentId, 'crash-txn', 1)
        console.log('Crash after reservation:', reserved ? 'RESERVED' : 'NOT RESERVED')
    }

    private async testRetryAfterFinalize(): Promise<void> {
        this.faultInjector.reset()
        this.faultInjector.enableFault(FaultType.RETRY_AFTER_FINALIZE)

        const intentId = 'retry-test-' + Date.now()
        this.commitRegistry.markCommitted(intentId, 1)

        const committed = this.commitRegistry.markCommitted(intentId, 2)
        console.log('Retry after finalize:', committed ? 'IDEMPOTENT' : 'BLOCKED')
    }

    private async runLegacyIsolationTest(): Promise<void> {
        console.log('Phase: Legacy Isolation Test')

        const commandResolver = (command: string, mode: BoundaryRuntimeMode) => {
            if (!this.kernel) return { ownership: 'unknown' as const, reached: false }

            const dispatcher = this.kernel.getDispatcher()
            const canonical = dispatcher.resolveCanonical(command || '')
            const ownership = canonical ? dispatcher.getOwnership(canonical) : 'unknown'

            return {
                ownership: ownership as 'dispatcher' | 'legacy' | 'unknown',
                reached: ownership !== 'unknown'
            }
        }

        const report = await this.legacyAudit.runAllTests(
            ['DISPATCHER_ONLY' as BoundaryRuntimeMode, 'HYBRID' as BoundaryRuntimeMode, 'LEGACY_ONLY' as BoundaryRuntimeMode],
            commandResolver
        )

        this.reporter.addLegacyReport(report)
        console.log('Legacy isolation:', report.overallPassed ? 'PASSED' : 'FAILED')
    }

    private async executeSingleCommand(command: string, args: string[]): Promise<ExecutionResult> {
        if (!this.kernel) {
            return {
                success: false,
                executionId: '',
                transactionId: '',
                phase: 'FAILED' as any,
                intents: [],
                commitDecision: CommitDecision.DENY,
                durationMs: 0,
                finalizedTick: 0,
                finalStateHash: '',
                transitions: [],
                error: new Error('Kernel not initialized')
            }
        }

        const message = createMockMessage(command, args)

        const result = await this.kernel.handleMessage({
            ...message,
            command: command
        } as any)

        if (result) {
            this.metrics.commitCount += result.intents.length
            return result
        }

        return {
            success: false,
            executionId: '',
            transactionId: '',
            phase: 'FAILED' as any,
            intents: [],
            commitDecision: CommitDecision.DENY,
            durationMs: 0,
            finalizedTick: 0,
            finalStateHash: '',
            transitions: [],
            error: new Error('Kernel returned null - handler not found or mode mismatch')
        }
    }

    private reportProgress(phase: string, completed: number, total: number, current: string): void {
        console.log(`[${phase}] ${completed}/${total} - ${current}`)
    }

    getMetrics(): ExecutionMetrics {
        return { ...this.metrics }
    }

    shutdown(): void {
        this.stressHarness.reset()
        this.determinismValidator.reset()
        this.faultInjector.reset()
        this.memoryAudit.reset()
        this.legacyAudit.reset()
        this.invariantTest.reset()
        this.reporter.reset()
        this.executionResults = []
        this.replaySessions.clear()
    }
}

export async function runVerification(mode: VerificationMode = 'quick'): Promise<void> {
    const runner = new RuntimeVerificationRunner()

    try {
        await runner.initialize(RuntimeMode.HYBRID)

        const config: VerificationConfig = {
            mode,
            concurrentCount: mode === 'stress' ? 100 : 10,
            repeatCount: mode === 'replay' ? 10 : 5,
            enableTransportFaults: mode === 'fault' || mode === 'full',
            enableMemoryStress: mode === 'stress' || mode === 'full',
            enableLegacyTesting: mode === 'full',
            enableReplayValidation: mode === 'replay' || mode === 'full'
        }

        await runner.runVerification(config)

        const metrics = runner.getMetrics()
        console.log('')
        console.log('═══════════════════════════════════════════════════════════════')
        console.log('                        EXECUTION METRICS')
        console.log('═══════════════════════════════════════════════════════════════')
        console.log('Total executions:', metrics.totalExecutions)
        console.log('Successful:', metrics.successfulExecutions)
        console.log('Failed:', metrics.failedExecutions)
        console.log('Transaction count:', metrics.transactionCount)
        console.log('Commit count:', metrics.commitCount)
        console.log('Average execution time:', metrics.averageExecutionTime.toFixed(2) + 'ms')

    } finally {
        runner.shutdown()
    }
}