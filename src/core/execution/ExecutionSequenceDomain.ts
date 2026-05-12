export interface ExecutionSequenceDomain {
    readonly executionId: string
    readonly transactionId: string
    nextIntentId(): string
    nextIntentSequence(): number
    getIntentSequence(): number
    tick(): void
    getTick(): number
    freezeAll(): void
}

export function createExecutionSequenceDomain(executionId: string, transactionId: string): ExecutionSequenceDomain {
    let intentSequence = 0
    let tick = 0

    const domain = {
        executionId,
        transactionId,
        nextIntentId: () => `intent-${executionId}-${++intentSequence}`,
        nextIntentSequence: () => ++intentSequence,
        getIntentSequence: () => intentSequence,
        tick: () => ++tick,
        getTick: () => tick,
        freezeAll: () => {
            Object.freeze(domain)
        }
    }

    return Object.freeze(domain)
}

export function freezeDeep<T>(value: T): Readonly<T> {
    if (value === null || value === undefined) {
        return value
    }

    if (typeof value !== 'object') {
        return value
    }

    if (value instanceof Date) {
        return value as unknown as Readonly<T>
    }

    if (value instanceof Map) {
        const frozen = new Map<any, any>()
        for (const [k, v] of value.entries()) {
            frozen.set(k, freezeDeep(v))
        }
        return Object.freeze(frozen) as unknown as Readonly<T>
    }

    if (value instanceof Set) {
        const frozen = new Set<any>()
        for (const v of value.values()) {
            frozen.add(freezeDeep(v))
        }
        return Object.freeze(frozen) as unknown as Readonly<T>
    }

    if (Array.isArray(value)) {
        const frozen = value.map(item => freezeDeep(item))
        return Object.freeze(frozen) as unknown as Readonly<T>
    }

    if (typeof value === 'object') {
        const frozen: Record<string, any> = {}
        for (const key of Object.keys(value as object)) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key)
            if (descriptor && descriptor.writable) {
                frozen[key] = freezeDeep((value as any)[key])
            } else {
                frozen[key] = freezeDeep((value as any)[key])
            }
        }
        return Object.freeze(frozen) as unknown as Readonly<T>
    }

    return value
}