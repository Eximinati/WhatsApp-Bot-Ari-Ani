import { EventEmitter } from 'events'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ErrorCategory = 
    | 'handler'
    | 'startup'
    | 'reconnect'
    | 'async'
    | 'timeout'
    | 'database'
    | 'network'
    | 'unknown'

export interface RuntimeError {
    id: string
    message: string
    stack?: string
    category: ErrorCategory
    severity: ErrorSeverity
    source: string
    phase: 'startup' | 'runtime' | 'shutdown'
    timestamp: number
    reconnectState?: boolean
    recovered: boolean
}

export class ErrorBoundary {
    private static instance: ErrorBoundary
    private errors: RuntimeError[] = []
    private maxErrors = 100
    private emitter = new EventEmitter()

    private constructor() {}

    static getInstance(): ErrorBoundary {
        if (!ErrorBoundary.instance) {
            ErrorBoundary.instance = new ErrorBoundary()
        }
        return ErrorBoundary.instance
    }

    capture(
        error: unknown,
        context: {
            category: ErrorCategory
            severity: ErrorSeverity
            source: string
            phase: 'startup' | 'runtime' | 'shutdown'
        }
    ): RuntimeError {
        const runtimeError: RuntimeError = {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            category: context.category,
            severity: context.severity,
            source: context.source,
            phase: context.phase,
            timestamp: Date.now(),
            reconnectState: undefined,
            recovered: true
        }

        this.errors.push(runtimeError)
        if (this.errors.length > this.maxErrors) {
            this.errors.shift()
        }

        this.emitter.emit('error', runtimeError)
        return runtimeError
    }

    getErrors(category?: ErrorCategory): RuntimeError[] {
        if (!category) return [...this.errors]
        return this.errors.filter(e => e.category === category)
    }

    getRecentErrors(count = 10): RuntimeError[] {
        return this.errors.slice(-count)
    }

    getErrorCount(): number {
        return this.errors.length
    }

    clearErrors(): void {
        this.errors = []
    }

    onError(handler: (error: RuntimeError) => void): void {
        this.emitter.on('error', handler)
    }

    safeAsync<T>(
        fn: () => Promise<T>,
        context: {
            category: ErrorCategory
            severity: ErrorSeverity
            source: string
            phase: 'startup' | 'runtime' | 'shutdown'
        }
    ): Promise<T | null> {
        return fn().catch(error => {
            this.capture(error, context)
            return null
        })
    }

    safeAsyncVoid(
        fn: (...args: unknown[]) => Promise<void>,
        context: {
            category: ErrorCategory
            severity: ErrorSeverity
            source: string
            phase: 'startup' | 'runtime' | 'shutdown'
        }
    ): (...args: unknown[]) => void {
        return (...args: unknown[]) => {
            fn(...args).catch(error => {
                this.capture(error, context)
            })
        }
    }
}

export const safeAsync = ErrorBoundary.getInstance().safeAsync.bind(ErrorBoundary.getInstance())
export const safeAsyncVoid = ErrorBoundary.getInstance().safeAsyncVoid.bind(ErrorBoundary.getInstance())