import { ErrorBoundary, safeAsyncVoid } from './ErrorBoundary.js'
import { StartupManager } from './StartupManager.js'
import { ExponentialBackoff } from './ExponentialBackoff.js'
import { TimerRegistry } from './TimerRegistry.js'

interface TestResult {
    name: string
    passed: boolean
    expected: string
    observed: string
    error?: string
}

const results: TestResult[] = []
const logs: string[] = []

function log(msg: string) {
    console.log(`[TEST] ${msg}`)
    logs.push(msg)
}

function assert(name: string, expected: string, observed: string, passed: boolean, error?: string) {
    results.push({ name, expected, observed, passed, error })
    const status = passed ? '✓ PASS' : '✗ FAIL'
    console.log(`${status}: ${name}`)
    if (!passed) {
        console.log(`  Expected: ${expected}`)
        console.log(`  Observed: ${observed}`)
        if (error) console.log(`  Error: ${error}`)
    }
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function runTests() {
    console.log('\n====== PHASE 2B VALIDATION SUITE ======\n')
    
    const timerRegistry = TimerRegistry.getInstance()
    const errorBoundary = ErrorBoundary.getInstance()
    const startupManager = StartupManager.getInstance()
    
    timerRegistry.clearAll()
    errorBoundary.clearErrors()
    startupManager.reset()

    // ========================================
    // TEST 1: HANDLER FAILURE CONTAINMENT
    // ========================================
    log('\n--- TEST 1: Handler Failure Containment ---')
    
    let runtimeAlive = true
    let handlerCallCount = 0
    let errorCaptureCount = 0
    
    const failingHandler = safeAsyncVoid(async (data: unknown) => {
        handlerCallCount++
        throw new Error(`Handler failure ${handlerCallCount}`)
    }, { category: 'handler', severity: 'high', source: 'test:fail-handler', phase: 'runtime' })
    
    errorBoundary.onError(() => {
        errorCaptureCount++
    })
    
    for (let i = 0; i < 3; i++) {
        runtimeAlive = true
        failingHandler({ test: true })
        await sleep(50)
    }
    
    await sleep(100)
    
    const test1Passed = runtimeAlive && errorCaptureCount === 3
    assert(
        'Handler failure should not crash runtime',
        'Runtime alive, 3 errors captured',
        `Runtime ${runtimeAlive ? 'alive' : 'crashed'}, ${errorCaptureCount} errors captured`,
        test1Passed,
        test1Passed ? undefined : 'Runtime crashed or errors not captured'
    )
    
    const test2Passed = handlerCallCount === 3
    assert(
        'Handler called 3 times despite failures',
        '3 calls',
        `${handlerCallCount} calls`,
        test2Passed
    )
    
    // ========================================
    // TEST 2: STARTUP FAILURE TEST
    // ========================================
    log('\n--- TEST 2: Startup Failure Test ---')
    
    startupManager.reset()
    errorBoundary.clearErrors()
    
    let startupFailed = false
    let failedStage: string | null = null
    
    try {
        await startupManager.start({
            environment: async () => {
                await sleep(10)
            },
            database: async () => {
                throw new Error('DB connection failed')
            },
            runtime: async () => {
                // Should not reach here
            }
        })
    } catch (error) {
        startupFailed = true
        failedStage = startupManager.getFailedStage()
    }
    
    const test3Passed = startupFailed && failedStage === 'database'
    assert(
        'Startup fails at correct stage',
        'Failed at database',
        `Failed at ${failedStage}`,
        test3Passed
    )
    
    const stageResults = startupManager.getStages()
    const test4Passed = stageResults.some(s => s.stage === 'environment' && s.status === 'success')
    assert(
        'Previous stage succeeded',
        'environment succeeded',
        stageResults.find(s => s.stage === 'environment')?.status || 'missing',
        test4Passed
    )
    
    const test5Passed = startupManager.isFailed()
    assert(
        'StartupManager recognizes failure',
        'isFailed() = true',
        `isFailed() = ${startupManager.isFailed()}`,
        test5Passed
    )
    
    // ========================================
    // TEST 3: RECONNECT FAILURE TEST
    // ========================================
    log('\n--- TEST 3: Reconnect Failure Test ---')
    
    const backoff = new ExponentialBackoff({
        initialDelay: 50,
        multiplier: 2,
        maxDelay: 5000,
        maxAttempts: 5,
        resetOnSuccess: true
    })
    
    let delays: number[] = []
    
    for (let i = 0; i < 4; i++) {
        backoff.startAttempt(`connection attempt ${i + 1}`)
        const delay = backoff.getBackoffDelay()
        delays.push(delay)
        if (backoff.shouldReconnect()) {
            await sleep(delay)
        }
    }
    
    const test6Passed = delays[0] === 50 && delays[1] === 100 && delays[2] === 200
    assert(
        'Exponential backoff escalates correctly',
        '50, 100, 200, 400',
        delays.join(', '),
        test6Passed
    )
    
    const test7Passed = backoff.shouldReconnect() === true
    assert(
        'shouldReconnect returns true before max attempts',
        'true',
        `${backoff.shouldReconnect()}`,
        test7Passed
    )
    
    // Simulate successful connection
    backoff.onSuccessfulConnect()
    
    const test8Passed = backoff.getState().attempt === 0
    assert(
        'Backoff resets after successful connect',
        'attempt = 0',
        `attempt = ${backoff.getState().attempt}`,
        test8Passed
    )
    
    // ========================================
    // TEST 4: TIMER CLEANUP VALIDATION
    // ========================================
    log('\n--- TEST 4: Timer Cleanup Validation ---')
    
    timerRegistry.clearAll()
    
    let cleanupCalled = false
    
    timerRegistry.registerTimeout('test-owner', () => {
        cleanupCalled = true
    }, 100, 'test-timeout-1')
    
    timerRegistry.registerInterval('other-owner', () => {}, 1000, 'test-interval-1')
    
    const beforeCount = timerRegistry.getCount()
    
    timerRegistry.clearByOwner('test-owner')
    
    const afterCount = timerRegistry.getCount()
    
    const test9Passed = beforeCount === 2 && afterCount === 1
    assert(
        'Timer cleanup removes all owner timers',
        'Before: 2, After: 1',
        `Before: ${beforeCount}, After: ${afterCount}`,
        test9Passed
    )
    
    timerRegistry.clearAll()
    
    timerRegistry.registerTimeout('reconnect', () => {}, 60000, 'reconnect-1')
    timerRegistry.registerTimeout('reconnect', () => {}, 60000, 'reconnect-2')
    timerRegistry.registerTimeout('other', () => {}, 60000, 'other-1')
    
    const diag = timerRegistry.getDiagnostics()
    
    const test10Passed = diag.byOwner['reconnect'] === 2
    assert(
        'TimerRegistry diagnostics accurate',
        'reconnect: 2',
        `reconnect: ${diag.byOwner['reconnect'] || 0}`,
        test10Passed
    )
    
    // ========================================
    // TEST 5: UNHANDLED PROMISE REJECTION
    // ========================================
    log('\n--- TEST 5: Unhandled Promise Rejection ---')
    
    errorBoundary.clearErrors()
    const asyncErrorCount = errorBoundary.getErrorCount()
    
    await errorBoundary.safeAsync(async () => {
        throw new Error('Async error test')
    }, { category: 'async', severity: 'high', source: 'test:unhandled', phase: 'runtime' })
    
    await sleep(50)
    
    const asyncAfterCount = errorBoundary.getErrorCount()
    
    const test11Passed = asyncAfterCount === asyncErrorCount + 1
    assert(
        'Async errors captured by ErrorBoundary',
        `Errors: ${asyncErrorCount + 1}`,
        `Errors: ${asyncAfterCount}`,
        test11Passed
    )
    
    // Test safeAsyncVoid with rejected promise
    let voidHandlerCalled = false
    const voidHandler = safeAsyncVoid(async (data: unknown) => {
        voidHandlerCalled = true
        throw new Error('Void handler error')
    }, { category: 'handler', severity: 'medium', source: 'test:void-handler', phase: 'runtime' })
    
    errorBoundary.clearErrors()
    voidHandler({ test: true })
    
    await sleep(50)
    
    const test12Passed = voidHandlerCalled && errorBoundary.getErrorCount() === 1
    assert(
        'safeAsyncVoid captures errors without crashing',
        'Handler called, 1 error captured',
        `Handler: ${voidHandlerCalled}, Errors: ${errorBoundary.getErrorCount()}`,
        test12Passed
    )
    
    // ========================================
    // TEST 6: MEMORY & LISTENER STABILITY
    // ========================================
    log('\n--- TEST 6: Listener & Timer Stability ---')
    
    timerRegistry.clearAll()
    
    // Simulate multiple reconnect cycles
    for (let cycle = 0; cycle < 5; cycle++) {
        timerRegistry.registerTimeout(`reconnect-cycle-${cycle}`, () => {}, 1000)
    }
    
    const timerCountAfterCycles = timerRegistry.getCount()
    
    // Cleanup and verify no accumulation
    timerRegistry.clearAll()
    
    const timerCountAfterCleanup = timerRegistry.getCount()
    
    const test13Passed = timerCountAfterCycles === 5 && timerCountAfterCleanup === 0
    assert(
        'No timer accumulation after cleanup',
        '5 timers active, 0 after cleanup',
        `${timerCountAfterCycles} active, ${timerCountAfterCleanup} after cleanup`,
        test13Passed
    )
    
    // ========================================
    // SUMMARY
    // ========================================
    log('\n====== VALIDATION SUMMARY ======')
    
    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    
    console.log(`\nPassed: ${passed}/${results.length}`)
    console.log(`Failed: ${failed}/${results.length}`)
    
    if (failed > 0) {
        console.log('\nFailed Tests:')
        results.filter(r => !r.passed).forEach(r => {
            console.log(`  - ${r.name}: ${r.error}`)
        })
    }
    
    // Final stability score
    const categories = {
        'Handler Failure Containment': results.filter(r => r.name.includes('Handler')).every(r => r.passed),
        'Startup Failure Handling': results.filter(r => r.name.includes('Startup') || r.name.includes('stage')).every(r => r.passed),
        'Reconnect Resilience': results.filter(r => r.name.includes('reconnect') || r.name.includes('Backoff')).every(r => r.passed),
        'Timer Safety': results.filter(r => r.name.includes('Timer')).every(r => r.passed),
        'Async Containment': results.filter(r => r.name.includes('Async') || r.name.includes('safeAsync')).every(r => r.passed),
        'Memory Stability': results.filter(r => r.name.includes('accumulation') || r.name.includes('timer')).every(r => r.passed)
    }
    
    console.log('\n====== STABILITY SCORE ======')
    let totalScore = 0
    for (const [category, passed] of Object.entries(categories)) {
        const score = passed ? 10 : 0
        totalScore += score
        console.log(`${passed ? '✓' : '✗'} ${category}: ${score}/10`)
    }
    
    console.log(`\nTOTAL: ${totalScore}/60`)
    
    if (totalScore >= 50) {
        console.log('\n>>> PHASE 2B VALIDATION: PASSED <<<')
        console.log('Runtime is ready for Phase 3 complexity.')
    } else {
        console.log('\n>>> PHASE 2B VALIDATION: NEEDS WORK <<<')
        console.log('Runtime requires fixes before Phase 3.')
    }
    
    process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(err => {
    console.error('Validation failed:', err)
    process.exit(1)
})