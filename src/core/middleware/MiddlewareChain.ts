import {
    MiddlewarePhase,
    MIDDLEWARE_PHASE_ORDER,
    DEFAULT_MIDDLEWARE_OPTIONS,
    type IMiddleware,
    type IMiddlewareChain,
    type InternalMiddlewareContext,
    type MiddlewareDiagnostics,
    type MiddlewareChainOptions,
    type NextFn,
    type AbortReason,
    type PipelineState,
    type PipelineStatus,
    type HandlerResult,
    type DiagnosticSeverity,
    type ExecutionState,
    DIAGNOSTIC_SEVERITY,
    DeepReadOnlyMiddlewareMetadata,
    createFrozenPermissions
} from './types.js'

const MAX_DIAGNOSTICS_ENTRIES = 500

let middlewareStartCounter = 0
let middlewareEndCounter = 0

const ABORT_CODE_TO_STATE: Record<string, PipelineState> = {
    TIMEOUT: 'timed_out',
    CONTRACT_VIOLATION: 'contract_violation',
    VALIDATION_FAILED: 'aborted',
    AUTH_FAILED: 'aborted',
    RATE_LIMITED: 'aborted',
    LOOP_DETECTED: 'aborted',
    PERMISSION_DENIED: 'aborted',
    DISABLED_FEATURE: 'aborted',
    MIDDLEWARE_ERROR: 'failed'
}

function classifySeverity(
    executionState: ExecutionState,
    abortCode: string | undefined,
    error: Error | null,
    timedOut: boolean
): DiagnosticSeverity {
    if (error || abortCode === 'CONTRACT_VIOLATION' || abortCode === 'LIFECYCLE_VIOLATION') {
        return DIAGNOSTIC_SEVERITY[abortCode ?? 'MIDDLEWARE_ERROR'] ?? 'error'
    }
    if (timedOut) return 'error'
    if (executionState === 'aborted' && abortCode) {
        return DIAGNOSTIC_SEVERITY[abortCode] ?? 'warn'
    }
    if (executionState === 'finalized') return 'info'
    return 'info'
}

export class MiddlewareChain implements IMiddlewareChain {
    private middleware: IMiddleware[] = []
    private diagnostics: Array<MiddlewareDiagnostics | null> = []
    private diagnosticsIndex = 0
    private options: MiddlewareChainOptions

    constructor(options: MiddlewareChainOptions = DEFAULT_MIDDLEWARE_OPTIONS) {
        this.options = options
        this.diagnostics = new Array(MAX_DIAGNOSTICS_ENTRIES).fill(null)
    }

    use(middleware: IMiddleware): void {
        const existing = this.middleware.find(m => m.name === middleware.name)
        if (existing) {
            throw new Error(`Middleware "${middleware.name}" already registered`)
        }
        this.middleware.push(middleware)
        this.sortMiddleware()
    }

    remove(name: string): boolean {
        const index = this.middleware.findIndex(m => m.name === name)
        if (index === -1) return false
        this.middleware.splice(index, 1)
        return true
    }

    has(name: string): boolean {
        return this.middleware.some(m => m.name === name)
    }

    getMiddleware(): readonly IMiddleware[] {
        return [...this.middleware]
    }

    getDiagnostics(): MiddlewareDiagnostics[] {
        return this.diagnostics.filter((d): d is MiddlewareDiagnostics => d !== null)
    }

    clearDiagnostics(): void {
        this.diagnostics = new Array(MAX_DIAGNOSTICS_ENTRIES).fill(null)
        this.diagnosticsIndex = 0
    }

    async execute(context: InternalMiddlewareContext): Promise<PipelineStatus> {
        const wallClockStart = ++middlewareStartCounter
        const sortedMiddleware = this.getSortedMiddleware()
        const completedPhases: MiddlewarePhase[] = []

        const pipelineStatus: PipelineStatus = {
            state: 'running',
            executionId: context.executionId,
            startTime: wallClockStart,
            endTime: null,
            durationMs: null,
            completedPhases: [],
            finalError: null,
            finalAbortReason: null
        }

        context._setPipelineState('running')

        try {
            for (const mw of sortedMiddleware) {
                if (mw.phase === MiddlewarePhase.POST_PROCESSING) continue

                context._setCurrentPhase(mw.phase)
                
                // FIX: Reset execution state for this middleware
                context._resetExecutionState()

                const result = await this.executeMiddlewareWithSafety(mw, context, pipelineStatus)

                if (result.contractViolation) {
                    pipelineStatus.state = 'contract_violation'
                    pipelineStatus.finalError = new Error('Middleware contract violation')
                    break
                }

                const pipelineState = context._getPipelineState()
                if (pipelineState !== 'running') {
                    const mappedState = context._getAbortReason()?.code
                        ? ABORT_CODE_TO_STATE[context._getAbortReason()!.code] ?? 'aborted'
                        : 'aborted'
                    pipelineStatus.state = mappedState
                    pipelineStatus.finalAbortReason = context._getAbortReason()
                    break
                }

                if (!completedPhases.includes(mw.phase)) {
                    completedPhases.push(mw.phase)
                }
            }

            if (pipelineStatus.state === 'running') {
                pipelineStatus.state = 'completed'
            }

        } catch (error) {
            pipelineStatus.state = 'failed'
            pipelineStatus.finalError = error instanceof Error ? error : new Error(String(error))
        } finally {
            // FIX 3: Post-processing executes BEFORE pipeline closes
            await this.runPostProcessingIsolated(context, pipelineStatus, completedPhases)

            // Pipeline lifecycle closes AFTER post-processing
            if (pipelineStatus.state === 'running') {
                pipelineStatus.state = 'completed'
            }

            const wallClockEnd = ++middlewareEndCounter
            pipelineStatus.endTime = wallClockEnd
            pipelineStatus.durationMs = wallClockEnd - wallClockStart

            if (!context.getResult()) {
                context.result = { success: pipelineStatus.state === 'completed' }
            }
        }

        return pipelineStatus
    }

    private async runPostProcessingIsolated(
        context: InternalMiddlewareContext,
        pipelineStatus: PipelineStatus,
        completedPhases: MiddlewarePhase[]
    ): Promise<void> {
        const postMiddleware = this.middleware
            .filter(m => m.phase === MiddlewarePhase.POST_PROCESSING)
            .sort((a, b) => a.order - b.order)

        // FIX 4: Explicit restricted context construction (no spread)
        const restrictedContext = this.createRestrictedContext(context)

        for (const mw of postMiddleware) {
            restrictedContext._setCurrentPhase(MiddlewarePhase.POST_PROCESSING)

            await this.executeMiddlewareWithSafety(
                mw,
                restrictedContext,
                pipelineStatus,
                'post-processing'
            )
        }
    }

    // FIX 4: No spread operator - explicit construction
    private createRestrictedContext(original: InternalMiddlewareContext): InternalMiddlewareContext {
        return {
            event: original.event,
            message: original.message,
            executionId: original.executionId,
            startTime: original.startTime,

            getCurrentPhase: () => original.getCurrentPhase(),
            _setCurrentPhase: (p: MiddlewarePhase) => original._setCurrentPhase(p),

            get metadata() {
                return new DeepReadOnlyMiddlewareMetadata(original.metadata)
            },

            get permissions() {
                return createFrozenPermissions(original.permissions)
            },

            get parsedArgs() { return original.parsedArgs },
            set parsedArgs(_) { throw new Error('ParsedArgs is read-only') },

            get result() { return original.result },
            set result(_) { throw new Error('Result is read-only') },

            get aborted() { return original.aborted },
            set aborted(_) { throw new Error('Abort state is read-only') },

            get abortReason() { return original.abortReason },
            set abortReason(_) { throw new Error('Abort reason is read-only') },

            abort: () => { throw new Error('Post-processing cannot abort') },
            canContinue: () => true,
            getResult: () => original.getResult(),
            finalizeResult: () => { throw new Error('Post-processing cannot finalize') },
            getExecutionState: () => original.getExecutionState(),

            _getPipelineState: () => original._getPipelineState(),
            _setPipelineState: (s: PipelineState) => { /* pass through */ },
            _getAbortReason: () => original._getAbortReason(),
            _resetExecutionState: () => { /* pass through for post-processing */ }
        }
    }

    // FIX 5: tryTransitionPattern instead of throw
    private tryTransitionExecutionState(
        context: InternalMiddlewareContext,
        fromState: ExecutionState,
        toState: ExecutionState
    ): boolean {
        const current = context.getExecutionState()
        if (current !== fromState) {
            return false
        }
        // Let context handle transition
        if (toState === 'proceeded') {
            // proceed() called - context will handle
        } else if (toState === 'aborted') {
            context.abort({
                code: 'TIMEOUT',
                message: 'Timeout during transition',
                atPhase: context.getCurrentPhase()
            })
        }
        return true
    }

    private async executeMiddlewareWithSafety(
        mw: IMiddleware,
        context: InternalMiddlewareContext,
        pipelineStatus: PipelineStatus,
        source: 'pipeline' | 'post-processing' = 'pipeline'
    ): Promise<{ aborted: boolean; timedOut: boolean; contractViolation: boolean }> {
        const durationStart = performance.now()
        let timerId: ReturnType<typeof setTimeout> | null = null
        let timeoutExpired = false

        const diag: MiddlewareDiagnostics = {
            executionId: context.executionId,
            middlewareName: mw.name,
            phase: mw.phase,
            order: mw.order,
            startTime: durationStart,
            endTime: null,
            durationMs: null,
            timedOut: false,
            error: null,
            aborted: false,
            abortReason: null,
            severity: 'info',
            source
        }

        const timeoutMs = mw.timeoutMs ?? this.options.defaultTimeoutMs ?? 30_000

        // FIX 8: Per-middleware execution state - context handles transitions
        const proceed: NextFn = async () => {
            // Context handles terminal transition
            // Only validate can continue
            if (!context.canContinue()) {
                throw new Error('Cannot proceed: execution already terminated')
            }
            if (timerId) {
                clearTimeout(timerId)
                timerId = null
            }
        }

        const finalizeResult = (result: HandlerResult) => {
            if (!context.canContinue()) {
                throw new Error('Cannot finalize: execution already terminated')
            }
            if (mw.phase !== MiddlewarePhase.EXECUTION) {
                throw new Error('Only EXECUTION phase may finalize result')
            }
            context.finalizeResult(result)
            if (timerId) {
                clearTimeout(timerId)
                timerId = null
            }
        }

        try {
            timerId = setTimeout(() => {
                timeoutExpired = true
                // FIX 5: Try pattern - don't throw, just attempt transition
                // If already terminated, safely no-op
                if (context.canContinue()) {
                    context.abort({
                        code: 'TIMEOUT',
                        message: `Middleware "${mw.name}" timed out after ${timeoutMs}ms`,
                        atPhase: mw.phase,
                        executionId: context.executionId,
                        middlewareName: mw.name
                    })
                }
            }, timeoutMs)

            await mw.execute(context, proceed, finalizeResult)

            if (timerId) {
                clearTimeout(timerId)
                timerId = null
            }

            // Contract validation - per-middleware scope
            const execState = context.getExecutionState()
            if (execState === 'none' && mw.phase !== MiddlewarePhase.POST_PROCESSING) {
                context.abort({
                    code: 'CONTRACT_VIOLATION',
                    message: `Middleware "${mw.name}" did not call proceed(), abort(), or finalizeResult()`,
                    atPhase: mw.phase,
                    executionId: context.executionId,
                    middlewareName: mw.name
                })
            }

            const durationEnd = performance.now()
            diag.endTime = durationEnd
            diag.durationMs = durationEnd - durationStart

        } catch (error) {
            if (timerId) {
                clearTimeout(timerId)
                timerId = null
            }

            const durationEnd = performance.now()
            diag.endTime = durationEnd
            diag.durationMs = durationEnd - durationStart

            if (timeoutExpired) {
                diag.timedOut = true
                diag.abortReason = 'timeout'
            } else if (error instanceof Error && error.message.includes('contract violation')) {
                diag.error = error
                diag.aborted = true
                diag.abortReason = 'contract_violation'
                return { aborted: true, timedOut: false, contractViolation: true }
            } else {
                diag.error = error instanceof Error ? error : new Error(String(error))
                diag.aborted = true

                // Only context handles abort transition
                context.abort({
                    code: 'MIDDLEWARE_ERROR',
                    message: diag.error.message,
                    atPhase: mw.phase,
                    executionId: context.executionId,
                    middlewareName: mw.name
                })

                if (!this.options.continueOnError) {
                    throw error
                }
            }
        }

        diag.severity = classifySeverity(
            context.getExecutionState(),
            context._getAbortReason()?.code,
            diag.error,
            diag.timedOut
        )

        if (diag.aborted && context._getAbortReason()) {
            diag.abortReason = context._getAbortReason()!.code
        }

        if (this.options.enableDiagnostics) {
            this.addDiagnostic(diag)
        }

        return {
            aborted: context.getExecutionState() !== 'none',
            timedOut: diag.timedOut,
            contractViolation: false
        }
    }

    private addDiagnostic(diag: MiddlewareDiagnostics): void {
        this.diagnostics[this.diagnosticsIndex] = diag
        this.diagnosticsIndex = (this.diagnosticsIndex + 1) % MAX_DIAGNOSTICS_ENTRIES
    }

    private getSortedMiddleware(): IMiddleware[] {
        return [...this.middleware].sort((a, b) => {
            const phaseDiff = MIDDLEWARE_PHASE_ORDER[a.phase] - MIDDLEWARE_PHASE_ORDER[b.phase]
            if (phaseDiff !== 0) return phaseDiff
            return a.order - b.order
        })
    }

    private sortMiddleware(): void {
        this.middleware.sort((a, b) => {
            const phaseDiff = MIDDLEWARE_PHASE_ORDER[a.phase] - MIDDLEWARE_PHASE_ORDER[b.phase]
            if (phaseDiff !== 0) return phaseDiff
            return a.order - b.order
        })
    }
}

export function createMiddlewareChain(options?: MiddlewareChainOptions): MiddlewareChain {
    return new MiddlewareChain(options)
}