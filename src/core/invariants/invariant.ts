import { RuntimeInvariantError } from './RuntimeInvariantError.js'

export type InvariantContext = Record<string, unknown>

export function invariant(
    condition: boolean,
    code: string,
    message: string,
    context: InvariantContext = {}
): asserts condition {
    if (!condition) {
        throw new RuntimeInvariantError(code, message, context)
    }
}

export function assertDefined<T>(
    value: T | null | undefined,
    code: string,
    message: string,
    context: InvariantContext = {}
): asserts value is T {
    invariant(value !== null && value !== undefined, code, message, context)
}

export function assertString(
    value: unknown,
    code: string,
    message: string,
    context: InvariantContext = {}
): asserts value is string {
    invariant(typeof value === 'string', code, message, context)
}

export function assertNumber(
    value: unknown,
    code: string,
    message: string,
    context: InvariantContext = {}
): asserts value is number {
    invariant(typeof value === 'number', code, message, context)
}

export function assertPositive(
    value: number,
    code: string,
    message: string,
    context: InvariantContext = {}
): asserts value is number {
    invariant(value > 0, code, message, context)
}

export function assertMonotonic(
    current: number,
    previous: number,
    code: string,
    message: string,
    context: InvariantContext = {}
): asserts current is number {
    invariant(current >= previous, code, message, { ...context, current, previous })
}