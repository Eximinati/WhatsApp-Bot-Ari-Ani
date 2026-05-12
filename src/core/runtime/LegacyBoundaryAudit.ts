import { RuntimeMode } from '../kernel/RuntimeKernel.js'

export type ExecutionOwnership = 'dispatcher' | 'legacy' | 'unknown'

export interface BoundaryTestCase {
    command: string
    expectedMode: RuntimeMode
    expectedOwnership: ExecutionOwnership
    shouldReachLegacy: boolean
    shouldReachDispatcher: boolean
}

export interface BoundaryTestResult {
    testCase: BoundaryTestCase
    actualMode: RuntimeMode | null
    actualOwnership: ExecutionOwnership
    reachedLegacy: boolean
    reachedDispatcher: boolean
    passed: boolean
    deviation: string | null
}

export interface LegacyBoundaryReport {
    dispatcherOnlyMode: {
        totalTests: number
        passed: number
        failed: number
        legacyLeaks: number
    }
    hybridMode: {
        totalTests: number
        passed: number
        failed: number
        ownershipLeaks: number
    }
    legacyOnlyMode: {
        totalTests: number
        passed: number
        failed: number
        dispatcherLeaks: number
    }
    overallPassed: boolean
    criticalIssues: string[]
}

export class LegacyBoundaryAudit {
    private testResults: BoundaryTestResult[] = []
    private executionLog: Array<{ command: string; ownership: ExecutionOwnership; mode: RuntimeMode }> = []

    async runAllTests(
        modes: RuntimeMode[],
        commandResolver: (command: string, mode: RuntimeMode) => { ownership: ExecutionOwnership; reached: boolean }
    ): Promise<LegacyBoundaryReport> {
        const testCases = this.generateTestCases()

        const dispatcherOnly = { totalTests: 0, passed: 0, failed: 0, legacyLeaks: 0 }
        const hybridMode = { totalTests: 0, passed: 0, failed: 0, ownershipLeaks: 0 }
        const legacyOnlyMode = { totalTests: 0, passed: 0, failed: 0, dispatcherLeaks: 0 }

        const criticalIssues: string[] = []

        for (const mode of modes) {
            for (const testCase of testCases) {
                const result = await this.runTestCase(testCase, mode, commandResolver)

                this.testResults.push(result)
                this.executionLog.push({
                    command: testCase.command,
                    ownership: result.actualOwnership,
                    mode: result.actualMode || mode
                })

                if (mode === RuntimeMode.DISPATCHER_ONLY) {
                    dispatcherOnly.totalTests++
                    if (result.passed) {
                        dispatcherOnly.passed++
                    } else {
                        dispatcherOnly.failed++
                        criticalIssues.push(`${mode}: ${testCase.command} - ${result.deviation}`)
                    }
                    if (result.reachedLegacy) dispatcherOnly.legacyLeaks++
                    if (!result.reachedDispatcher && testCase.shouldReachDispatcher) dispatcherOnly.legacyLeaks++
                } else if (mode === RuntimeMode.LEGACY_ONLY) {
                    legacyOnlyMode.totalTests++
                    if (result.passed) {
                        legacyOnlyMode.passed++
                    } else {
                        legacyOnlyMode.failed++
                        criticalIssues.push(`${mode}: ${testCase.command} - ${result.deviation}`)
                    }
                    if (result.reachedDispatcher) legacyOnlyMode.dispatcherLeaks++
                    if (result.reachedLegacy && !testCase.shouldReachLegacy) legacyOnlyMode.dispatcherLeaks++
                } else {
                    hybridMode.totalTests++
                    if (result.passed) {
                        hybridMode.passed++
                    } else {
                        hybridMode.failed++
                        criticalIssues.push(`${mode}: ${testCase.command} - ${result.deviation}`)
                    }
                    if (result.actualOwnership !== testCase.expectedOwnership) {
                        hybridMode.ownershipLeaks++
                    }
                }
            }
        }

        return {
            dispatcherOnlyMode: dispatcherOnly,
            hybridMode: hybridMode,
            legacyOnlyMode: legacyOnlyMode,
            overallPassed: dispatcherOnly.failed === 0 && hybridMode.failed === 0 && legacyOnlyMode.failed === 0,
            criticalIssues
        }
    }

    private generateTestCases(): BoundaryTestCase[] {
        return [
            {
                command: 'ping',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'dispatcher',
                shouldReachLegacy: false,
                shouldReachDispatcher: true
            },
            {
                command: '!ping',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'dispatcher',
                shouldReachLegacy: false,
                shouldReachDispatcher: true
            },
            {
                command: 'help',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'dispatcher',
                shouldReachLegacy: false,
                shouldReachDispatcher: true
            },
            {
                command: 'unknowncmd',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'unknown',
                shouldReachLegacy: false,
                shouldReachDispatcher: false
            },
            {
                command: 'admin',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'legacy',
                shouldReachLegacy: true,
                shouldReachDispatcher: false
            },
            {
                command: 'mod',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'legacy',
                shouldReachLegacy: true,
                shouldReachDispatcher: false
            },
            {
                command: 'play',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'dispatcher',
                shouldReachLegacy: false,
                shouldReachDispatcher: true
            },
            {
                command: 'yt',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'dispatcher',
                shouldReachLegacy: false,
                shouldReachDispatcher: true
            },
            {
                command: '',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'unknown',
                shouldReachLegacy: false,
                shouldReachDispatcher: false
            },
            {
                command: 'PING',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'dispatcher',
                shouldReachLegacy: false,
                shouldReachDispatcher: true
            },
            {
                command: 'Ping',
                expectedMode: RuntimeMode.HYBRID,
                expectedOwnership: 'dispatcher',
                shouldReachLegacy: false,
                shouldReachDispatcher: true
            }
        ]
    }

    private async runTestCase(
        testCase: BoundaryTestCase,
        mode: RuntimeMode,
        commandResolver: (command: string, mode: RuntimeMode) => { ownership: ExecutionOwnership; reached: boolean }
    ): Promise<BoundaryTestResult> {
        const resolution = commandResolver(testCase.command, mode)

        let deviation: string | null = null
        let passed = true

        if (mode === RuntimeMode.DISPATCHER_ONLY) {
            if (resolution.reached && testCase.shouldReachLegacy) {
                deviation = 'Command reached legacy in DISPATCHER_ONLY mode'
                passed = false
            }
            if (!resolution.reached && testCase.shouldReachDispatcher && resolution.ownership !== 'dispatcher') {
                deviation = 'Command did not reach dispatcher in DISPATCHER_ONLY mode'
                passed = false
            }
        } else if (mode === RuntimeMode.LEGACY_ONLY) {
            if (resolution.reached && testCase.shouldReachDispatcher) {
                deviation = 'Command reached dispatcher in LEGACY_ONLY mode'
                passed = false
            }
            if (resolution.ownership === 'dispatcher') {
                deviation = 'Command assigned to dispatcher in LEGACY_ONLY mode'
                passed = false
            }
        } else if (mode === RuntimeMode.HYBRID) {
            if (resolution.ownership !== testCase.expectedOwnership) {
                deviation = `Ownership mismatch: expected ${testCase.expectedOwnership}, got ${resolution.ownership}`
                passed = false
            }
        }

        return {
            testCase,
            actualMode: mode,
            actualOwnership: resolution.ownership,
            reachedLegacy: testCase.shouldReachLegacy && resolution.ownership === 'legacy',
            reachedDispatcher: testCase.shouldReachDispatcher && resolution.ownership === 'dispatcher',
            passed,
            deviation
        }
    }

    forceTestCommandAliasCollision(
        alias1: string,
        alias2: string,
        commandResolver: (cmd: string) => ExecutionOwnership
    ): { resolved: string; collision: boolean } {
        const owner1 = commandResolver(alias1)
        const owner2 = commandResolver(alias2)

        const collision = owner1 !== owner2 || (owner1 === 'unknown' && owner2 === 'unknown')

        return {
            resolved: owner1,
            collision
        }
    }

    verifyMigratedHandlersNeverUseLegacyTransport(
        handlers: Map<string, string>,
        legacyCommands: Set<string>
    ): { migrated: string[]; leaked: string[] } {
        const migrated: string[] = []
        const leaked: string[] = []

        for (const [command, ownership] of handlers) {
            if (ownership === 'dispatcher' && !legacyCommands.has(command)) {
                migrated.push(command)
            } else if (ownership === 'dispatcher' && legacyCommands.has(command)) {
                leaked.push(command)
            }
        }

        return { migrated, leaked }
    }

    getExecutionLog(): Array<{ command: string; ownership: ExecutionOwnership; mode: RuntimeMode }> {
        return [...this.executionLog]
    }

    getTestResults(): BoundaryTestResult[] {
        return [...this.testResults]
    }

    reset(): void {
        this.testResults = []
        this.executionLog = []
    }
}