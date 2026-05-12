export class RuntimeInvariantError extends Error {
    readonly code: string
    readonly context: Record<string, unknown>

    constructor(code: string, message: string, context: Record<string, unknown> = {}) {
        super(message)
        this.name = 'RuntimeInvariantError'
        this.code = code
        this.context = Object.freeze({ ...context })
        Error.captureStackTrace(this, RuntimeInvariantError)
    }

    toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            context: this.context,
            stack: this.stack
        }
    }
}