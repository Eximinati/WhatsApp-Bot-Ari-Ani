import type { RuntimeEvent } from '../event-bus/types.js'
import type { NormalizedMessage } from '../serializer/types.js'

export enum MiddlewarePhase {
    VALIDATION = 'validation',
    SECURITY = 'security',
    ENRICHMENT = 'enrichment',
    ROUTING = 'routing',
    EXECUTION = 'execution',
    PRE_COMMIT = 'pre-commit',
    COMMIT = 'commit',
    POST_COMMIT = 'post-commit',
    POST_PROCESSING = 'post-processing'
}

export const MIDDLEWARE_PHASE_ORDER: Record<MiddlewarePhase, number> = {
    [MiddlewarePhase.VALIDATION]: 0,
    [MiddlewarePhase.SECURITY]: 1,
    [MiddlewarePhase.ENRICHMENT]: 2,
    [MiddlewarePhase.ROUTING]: 3,
    [MiddlewarePhase.EXECUTION]: 4,
    [MiddlewarePhase.PRE_COMMIT]: 5,
    [MiddlewarePhase.COMMIT]: 6,
    [MiddlewarePhase.POST_COMMIT]: 7,
    [MiddlewarePhase.POST_PROCESSING]: 8
}

export type PipelineState = 'running' | 'completed' | 'aborted' | 'failed' | 'timed_out' | 'contract_violation'

export type DiagnosticSeverity = 'info' | 'warn' | 'error' | 'fatal'

// Per-middleware execution state
export type ExecutionState = 'none' | 'proceeded' | 'aborted' | 'finalized'

export interface PipelineStatus {
    state: PipelineState
    executionId: string
    startTime: number
    endTime: number | null
    durationMs: number | null
    completedPhases: MiddlewarePhase[]
    finalError: Error | null
    finalAbortReason: AbortReason | null
}

export interface ParsedArgs {
    readonly args: readonly string[]
    readonly flags: readonly string[]
    readonly joined: string
    readonly raw: string
}

export interface PermissionSet {
    isMod: boolean
    isAdmin: boolean
    isOwner: boolean
    canReact: boolean
    canSendMedia: boolean
    canSendLinks: boolean
}

export type AbortCode =
    | 'VALIDATION_FAILED'
    | 'AUTH_FAILED'
    | 'RATE_LIMITED'
    | 'LOOP_DETECTED'
    | 'PERMISSION_DENIED'
    | 'DISABLED_FEATURE'
    | 'MIDDLEWARE_ERROR'
    | 'TIMEOUT'
    | 'DOUBLE_PROCEED_VIOLATION'
    | 'CONTRACT_VIOLATION'
    | 'LIFECYCLE_VIOLATION'

export interface AbortReason {
    code: AbortCode
    message: string
    metadata?: Record<string, unknown>
    atPhase?: MiddlewarePhase
    executionId?: string
    middlewareName?: string
}

export interface HandlerResult {
    success: boolean
    response?: string
    error?: Error
    metadata?: Record<string, unknown>
    durationMs?: number
}

export interface MiddlewareMetadata {
    get(key: string): unknown
    set(key: string, value: unknown): void
    has(key: string): boolean
    delete(key: string): boolean
    clear(): void
    toObject(): Record<string, unknown>
}

export class MapMiddlewareMetadata implements MiddlewareMetadata {
    private map = new Map<string, unknown>()

    get(key: string): unknown {
        return this.map.get(key)
    }

    set(key: string, value: unknown): void {
        this.map.set(key, value)
    }

    has(key: string): boolean {
        return this.map.has(key)
    }

    delete(key: string): boolean {
        return this.map.delete(key)
    }

    clear(): void {
        this.map.clear()
    }

    toObject(): Record<string, unknown> {
        return Object.fromEntries(this.map)
    }
}

// FIX 6: Deep read-only metadata
export class DeepReadOnlyMiddlewareMetadata implements MiddlewareMetadata {
    constructor(private inner: MiddlewareMetadata) {}

    private deepClone(obj: unknown): unknown {
        if (obj === null || typeof obj !== 'object') return obj
        if (Array.isArray(obj)) return obj.map(x => this.deepClone(x))
        const cloned: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(obj)) {
            cloned[k] = this.deepClone(v)
        }
        return Object.freeze(cloned)
    }

    get(key: string): unknown {
        const value = this.inner.get(key)
        return value ? this.deepClone(value) : undefined
    }

    set(): void { throw new Error('Metadata is read-only') }
    has(key: string): boolean { return this.inner.has(key) }
    delete(): boolean { throw new Error('Metadata is read-only') }
    clear(): void { throw new Error('Metadata is read-only') }

    toObject(): Record<string, unknown> {
        return this.deepClone(this.inner.toObject()) as Record<string, unknown>
    }
}

export interface MiddlewareDiagnostics {
    executionId: string
    middlewareName: string
    phase: MiddlewarePhase
    order: number
    startTime: number
    endTime: number | null
    durationMs: number | null
    timedOut: boolean
    error: Error | null
    aborted: boolean
    abortReason: string | null
    severity: DiagnosticSeverity
    source: 'pipeline' | 'post-processing'
}

// Public API
export interface MiddlewareContext {
    readonly event: RuntimeEvent
    readonly message: NormalizedMessage
    readonly executionId: string
    readonly startTime: number

    getCurrentPhase(): MiddlewarePhase

    metadata: MiddlewareMetadata
    permissions: PermissionSet
    parsedArgs: ParsedArgs | null

    result: HandlerResult | null
    aborted: boolean
    abortReason: AbortReason | null

    abort(reason: AbortReason): void
    canContinue(): boolean
    getResult(): HandlerResult | null
    finalizeResult(result: HandlerResult): void

    getExecutionState(): ExecutionState
}

// Internal API - runtime only
export interface InternalMiddlewareContext extends MiddlewareContext {
    _setCurrentPhase(phase: MiddlewarePhase): void
    _getPipelineState(): PipelineState
    _setPipelineState(state: PipelineState): void
    _getAbortReason(): AbortReason | null
    _resetExecutionState(): void  // Reset for next middleware
}

interface MiddlewareExecutionScope {
    executionState: ExecutionState
    aborted: boolean
    abortReason: AbortReason | null
    result: HandlerResult | null
    
    reset(): void  // Reset for next middleware
}

let internalExecutionCounter = 0

function generateInternalExecutionId(): string {
    return `exec-${++internalExecutionCounter}`
}

let internalStartTickCounter = 0

function getDeterministicStartTick(): number {
    return ++internalStartTickCounter
}

export function createInternalMiddlewareContext(
    event: RuntimeEvent,
    message: NormalizedMessage,
    initialPhase: MiddlewarePhase = MiddlewarePhase.VALIDATION
): InternalMiddlewareContext {
    const executionId = generateInternalExecutionId()
    const startTick = getDeterministicStartTick()

    const executionScope: MiddlewareExecutionScope = {
        executionState: 'none',
        aborted: false,
        abortReason: null,
        result: null,
        
        reset(): void {
            this.executionState = 'none'
            this.aborted = false
            this.abortReason = null
            this.result = null
        }
    }

    let currentPhase: MiddlewarePhase = initialPhase
    let pipelineState: PipelineState = 'running'

    let deterministicStartTick = 0

    return {
        event,
        message,
        executionId,
        startTime: startTick,

        getCurrentPhase(): MiddlewarePhase {
            return currentPhase
        },

        _setCurrentPhase(phase: MiddlewarePhase): void {
            currentPhase = phase
        },

        metadata: new MapMiddlewareMetadata(),
        permissions: {
            isMod: false,
            isAdmin: false,
            isOwner: false,
            canReact: true,
            canSendMedia: true,
            canSendLinks: true
        },
        parsedArgs: null,

        get result() {
            return executionScope.result
        },
        set result(value: HandlerResult | null) {
            executionScope.result = value
        },

        get aborted() {
            return executionScope.aborted
        },
        set aborted(value: boolean) {
            executionScope.aborted = value
        },

        get abortReason() {
            return executionScope.abortReason
        },
        set abortReason(value: AbortReason | null) {
            executionScope.abortReason = value
        },

        // FIX 1 & 8: ONLY context owns terminal transitions
        abort(reason: AbortReason): void {
            if (executionScope.executionState !== 'none') return
            
            // FIX 6: Phase ownership validation
            if (initialPhase === MiddlewarePhase.ENRICHMENT) {
                throw new Error('ENRICHMENT phase cannot abort')
            }
            if (initialPhase === MiddlewarePhase.POST_PROCESSING) {
                throw new Error('POST_PROCESSING phase cannot abort')
            }
            
            executionScope.executionState = 'aborted'
            executionScope.aborted = true
            executionScope.abortReason = reason
        },

        canContinue(): boolean {
            return executionScope.executionState === 'none'
        },

        getResult(): HandlerResult | null {
            return executionScope.result
        },

        finalizeResult(result: HandlerResult): void {
            if (executionScope.executionState !== 'none') return
            executionScope.executionState = 'finalized'
            executionScope.result = result
        },

        getExecutionState(): ExecutionState {
            return executionScope.executionState
        },

        _getPipelineState(): PipelineState {
            return pipelineState
        },

        _setPipelineState(state: PipelineState): void {
            pipelineState = state
        },

        _getAbortReason(): AbortReason | null {
            return executionScope.abortReason
        },

        // FIX: Reset execution state for next middleware
        _resetExecutionState(): void {
            executionScope.reset()
        }
    }
}

export type MiddlewareExecuteFn = (
    context: InternalMiddlewareContext,
    proceed: NextFn,
    finalizeResult: (result: HandlerResult) => void
) => Promise<void>

export type NextFn = () => Promise<void>

export interface IMiddleware {
    readonly name: string
    readonly phase: MiddlewarePhase
    readonly order: number
    readonly timeoutMs?: number

    execute(context: InternalMiddlewareContext, proceed: NextFn, finalizeResult: (r: HandlerResult) => void): Promise<void>
}

export interface IMiddlewareChain {
    execute(context: InternalMiddlewareContext): Promise<PipelineStatus>
    use(middleware: IMiddleware): void
    remove(name: string): boolean
    getMiddleware(): readonly IMiddleware[]
    has(name: string): boolean
    getDiagnostics(): MiddlewareDiagnostics[]
    clearDiagnostics(): void
}

export const DEFAULT_PERMISSIONS: PermissionSet = {
    isMod: false,
    isAdmin: false,
    isOwner: false,
    canReact: true,
    canSendMedia: true,
    canSendLinks: true
}

export interface MiddlewareChainOptions {
    defaultTimeoutMs?: number
    continueOnError?: boolean
    enableDiagnostics?: boolean
}

export const DEFAULT_MIDDLEWARE_OPTIONS: MiddlewareChainOptions = {
    defaultTimeoutMs: 30_000,
    continueOnError: true,
    enableDiagnostics: true
}

export const MIDDLEWARE_SAFETY_RULES = `
Middleware MUST NEVER:
- retain context references after execution
- spawn uncontrolled async
- mutate normalized message
- mutate event payload
`

// FIX 7: Add LIFECYCLE_VIOLATION severity
export const DIAGNOSTIC_SEVERITY: Record<string, DiagnosticSeverity> = {
    TIMEOUT: 'error',
    CONTRACT_VIOLATION: 'fatal',
    LIFECYCLE_VIOLATION: 'fatal',
    VALIDATION_FAILED: 'error',
    AUTH_FAILED: 'warn',
    RATE_LIMITED: 'warn',
    LOOP_DETECTED: 'warn',
    PERMISSION_DENIED: 'warn',
    DISABLED_FEATURE: 'info',
    MIDDLEWARE_ERROR: 'error'
}

export function createFrozenPermissions(perms: PermissionSet): Readonly<PermissionSet> {
    return Object.freeze({ ...perms })
}

export class LegacyMiddlewareContextAdapter implements InternalMiddlewareContext {
    constructor(
        private inner: InternalMiddlewareContext,
        private emitWarning: (msg: string) => void = () => {}
    ) {}

    private warn(field: string): void {
        this.emitWarning(`[LEGACY] Direct mutation of ${field}`)
    }

    get event() { return this.inner.event }
    get message() { return this.inner.message }
    get executionId() { return this.inner.executionId }
    get startTime() { return this.inner.startTime }
    get currentPhase() { return this.inner.getCurrentPhase() }
    set currentPhase(v) { this.inner._setCurrentPhase(v) }

    getCurrentPhase() { return this.inner.getCurrentPhase() }

    get metadata() { return this.inner.metadata }
    set metadata(v) { this.inner.metadata = v }

    get permissions() { return this.inner.permissions }
    set permissions(v) { this.warn('permissions'); this.inner.permissions = v }

    get parsedArgs() { return this.inner.parsedArgs }
    set parsedArgs(v) { this.inner.parsedArgs = v }

    get result() { return this.inner.result }
    set result(v) { this.warn('result'); this.inner.result = v }

    get aborted() { return this.inner.aborted }
    set aborted(v) { this.warn('aborted'); this.inner.aborted = v }

    get abortReason() { return this.inner.abortReason }
    set abortReason(v) { this.warn('abortReason'); this.inner.abortReason = v }

    abort(r: AbortReason) { this.inner.abort(r) }
    canContinue() { return this.inner.canContinue() }
    getResult() { return this.inner.getResult() }
    finalizeResult(r: HandlerResult) { this.inner.finalizeResult(r) }
    getExecutionState() { return this.inner.getExecutionState() }

    _setCurrentPhase(p: MiddlewarePhase) { this.inner._setCurrentPhase(p) }
    _getPipelineState() { return this.inner._getPipelineState() }
    _setPipelineState(s: PipelineState) { this.inner._setPipelineState(s) }
    _getAbortReason() { return this.inner._getAbortReason() }
    _resetExecutionState() { this.inner._resetExecutionState() }
}