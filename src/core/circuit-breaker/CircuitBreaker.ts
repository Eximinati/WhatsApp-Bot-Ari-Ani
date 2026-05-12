export interface CircuitState {
    status: 'closed' | 'open' | 'half-open'
    failureCount: number
    lastFailureAt: number | null
    nextAttemptAt: number | null
}

export interface ICircuitBreaker {
    allow(chatJid: string): boolean
    record(chatJid: string, success: boolean): void
    getState(chatJid: string): CircuitState | null
    reset(chatJid: string): void
    resetAll(): void
}

interface ChatCircuit {
    state: 'closed' | 'open' | 'half-open'
    failureCount: number
    lastFailureAt: number | null
    nextAttemptAt: number | null
    successCount: number
}

export class PerChatCircuitBreaker implements ICircuitBreaker {
    private circuits = new Map<string, ChatCircuit>()
    private readonly failureThreshold: number
    private readonly successThreshold: number
    private readonly timeoutMs: number

    constructor(options: {
        failureThreshold?: number
        successThreshold?: number
        timeoutMs?: number
    } = {}) {
        this.failureThreshold = options.failureThreshold ?? 10
        this.successThreshold = options.successThreshold ?? 3
        this.timeoutMs = options.timeoutMs ?? 30_000
    }

    allow(chatJid: string): boolean {
        const circuit = this.circuits.get(chatJid)

        if (!circuit) {
            return true
        }

        if (circuit.state === 'closed') {
            return true
        }

        if (circuit.state === 'open') {
            if (circuit.nextAttemptAt && Date.now() >= circuit.nextAttemptAt) {
                circuit.state = 'half-open'
                circuit.successCount = 0
                return true
            }
            return false
        }

        if (circuit.state === 'half-open') {
            return true
        }

        return true
    }

    record(chatJid: string, success: boolean): void {
        let circuit = this.circuits.get(chatJid)

        if (!circuit) {
            circuit = {
                state: 'closed',
                failureCount: 0,
                lastFailureAt: null,
                nextAttemptAt: null,
                successCount: 0
            }
            this.circuits.set(chatJid, circuit)
        }

        if (success) {
            if (circuit.state === 'half-open') {
                circuit.successCount++
                if (circuit.successCount >= this.successThreshold) {
                    this.reset(chatJid)
                }
            } else {
                circuit.failureCount = Math.max(0, circuit.failureCount - 1)
            }
        } else {
            circuit.failureCount++
            circuit.lastFailureAt = Date.now()

            if (circuit.state === 'half-open' || circuit.failureCount >= this.failureThreshold) {
                circuit.state = 'open'
                circuit.nextAttemptAt = Date.now() + this.timeoutMs
            }
        }
    }

    getState(chatJid: string): CircuitState | null {
        const circuit = this.circuits.get(chatJid)

        if (!circuit) {
            return null
        }

        return {
            status: circuit.state,
            failureCount: circuit.failureCount,
            lastFailureAt: circuit.lastFailureAt,
            nextAttemptAt: circuit.nextAttemptAt
        }
    }

    reset(chatJid: string): void {
        this.circuits.delete(chatJid)
    }

    resetAll(): void {
        this.circuits.clear()
    }

    getActiveCircuits(): number {
        return this.circuits.size
    }
}

let circuitBreakerInstance: PerChatCircuitBreaker | null = null

export function getCircuitBreaker(): PerChatCircuitBreaker {
    if (!circuitBreakerInstance) {
        circuitBreakerInstance = new PerChatCircuitBreaker()
    }
    return circuitBreakerInstance
}