import type RuntimeClient from '../RuntimeClient.js'
import { ExecutionPhase } from '../execution/ExecutionCoordinator.js'

export enum SafetyLevel {
    NORMAL = 'NORMAL',
    ELEVATED = 'ELEVATED',
    CRITICAL = 'CRITICAL',
    EMERGENCY = 'EMERGENCY'
}

export enum RuntimeHealth {
    HEALTHY = 'HEALTHY',
    DEGRADED = 'DEGRADED',
    CRITICAL = 'CRITICAL',
    SHUTDOWN = 'SHUTDOWN'
}

export interface SafetyConfig {
    executionTimeoutMs: number
    transactionTimeoutMs: number
    maxQueueSize: number
    maxRetries: number
    heartbeatIntervalMs: number
    stuckThresholdMs: number
}

export interface GuardMetrics {
    activeExecutions: number
    stuckTransactions: number
    queueDepth: number
    failedCommits: number
    emergencyAborts: number
}

const DEFAULT_CONFIG: SafetyConfig = {
    executionTimeoutMs: 30_000,
    transactionTimeoutMs: 60_000,
    maxQueueSize: 1000,
    maxRetries: 3,
    heartbeatIntervalMs: 5_000,
    stuckThresholdMs: 30_000
}

export class LiveRuntimeSafetyGuards {
    private config: SafetyConfig
    private client: RuntimeClient
    private health: RuntimeHealth = RuntimeHealth.HEALTHY
    private safetyLevel: SafetyLevel = SafetyLevel.NORMAL
    private activeTransactions = new Map<string, { startTime: number; phase: ExecutionPhase }>()
    private intentQueue: Array<{ id: string; created: number }> = []
    private commitFailures = new Map<string, number>()
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null

    constructor(client: RuntimeClient, config: Partial<SafetyConfig> = {}) {
        this.client = client
        this.config = { ...DEFAULT_CONFIG, ...config }
        this.startHeartbeat()
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            this.checkStuckTransactions()
            this.checkQueueOverflow()
            this.checkCommitFailures()
            this.updateHealthState()
        }, this.config.heartbeatIntervalMs)
    }

    stop(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval)
            this.heartbeatInterval = null
        }
    }

    registerTransaction(transactionId: string, phase: ExecutionPhase = ExecutionPhase.CREATED): void {
        this.activeTransactions.set(transactionId, {
            startTime: Date.now(),
            phase
        })
    }

    updateTransactionPhase(transactionId: string, phase: ExecutionPhase): void {
        const txn = this.activeTransactions.get(transactionId)
        if (txn) {
            txn.phase = phase
        }
    }

    completeTransaction(transactionId: string): boolean {
        return this.activeTransactions.delete(transactionId)
    }

    private checkStuckTransactions(): void {
        const now = Date.now()
        const stuck: string[] = []

        for (const [id, txn] of this.activeTransactions) {
            const elapsed = now - txn.startTime
            if (elapsed > this.config.stuckThresholdMs) {
                stuck.push(id)
            }
        }

        if (stuck.length > 0) {
            this.client.log(`[SAFETY] Detected ${stuck.length} stuck transactions`, true)
            this.safetyLevel = SafetyLevel.ELEVATED
            for (const id of stuck) {
                this.forceAbortTransaction(id, 'Stuck exceeded threshold')
            }
        }
    }

    private forceAbortTransaction(transactionId: string, reason: string): void {
        this.client.log(`[SAFETY] Force abort: ${transactionId} - ${reason}`, true)
        this.activeTransactions.delete(transactionId)
    }

    private checkQueueOverflow(): void {
        if (this.intentQueue.length >= this.config.maxQueueSize) {
            this.client.log(`[SAFETY] Queue overflow: ${this.intentQueue.length}/${this.config.maxQueueSize}`, true)
            this.safetyLevel = SafetyLevel.ELEVATED
            const overflow = this.intentQueue.length - this.config.maxQueueSize
            this.intentQueue.splice(0, overflow)
        }
    }

    private checkCommitFailures(): void {
        const now = Date.now()
        for (const [id, failures] of this.commitFailures) {
            if (failures >= this.config.maxRetries) {
                this.client.log(`[SAFETY] Commit ceiling reached for: ${id}`, true)
                this.commitFailures.delete(id)
                this.safetyLevel = SafetyLevel.CRITICAL
            }
        }

        const stale = [...this.commitFailures.entries()].filter(([_, count]) => count === 0)
        for (const [id] of stale) {
            this.commitFailures.delete(id)
        }
    }

    recordCommitFailure(transactionId: string): void {
        const current = this.commitFailures.get(transactionId) ?? 0
        this.commitFailures.set(transactionId, current + 1)
    }

    canRetryCommit(transactionId: string): boolean {
        return (this.commitFailures.get(transactionId) ?? 0) < this.config.maxRetries
    }

    private updateHealthState(): void {
        const metrics = this.getMetrics()

        if (metrics.stuckTransactions > 5 || metrics.emergencyAborts > 3) {
            this.health = RuntimeHealth.CRITICAL
        } else if (metrics.stuckTransactions > 0 || metrics.failedCommits > 10) {
            this.health = RuntimeHealth.DEGRADED
        } else {
            this.health = RuntimeHealth.HEALTHY
        }
    }

    getMetrics(): GuardMetrics {
        return {
            activeExecutions: this.activeTransactions.size,
            stuckTransactions: this.countStuckTransactions(),
            queueDepth: this.intentQueue.length,
            failedCommits: this.commitFailures.size,
            emergencyAborts: 0
        }
    }

    private countStuckTransactions(): number {
        const now = Date.now()
        let count = 0
        for (const txn of this.activeTransactions.values()) {
            if (now - txn.startTime > this.config.stuckThresholdMs) {
                count++
            }
        }
        return count
    }

    getHealth(): RuntimeHealth {
        return this.health
    }

    getSafetyLevel(): SafetyLevel {
        return this.safetyLevel
    }

    async emergencyShutdown(): Promise<void> {
        this.client.log('[SAFETY] EMERGENCY SHUTDOWN initiated', true)
        this.safetyLevel = SafetyLevel.EMERGENCY
        this.health = RuntimeHealth.SHUTDOWN

        for (const [id] of this.activeTransactions) {
            this.forceAbortTransaction(id, 'Emergency shutdown')
        }

        this.intentQueue = []
        this.commitFailures.clear()

        this.stop()
    }

    async degradedModeFallback(): Promise<void> {
        this.client.log('[SAFETY] Entering degraded mode', true)
        this.safetyLevel = SafetyLevel.ELEVATED

        if (this.health !== RuntimeHealth.CRITICAL) {
            this.health = RuntimeHealth.DEGRADED
        }
    }

    enforceExecutionTimeout(handlerName: string, startTime: number): void {
        const elapsed = Date.now() - startTime
        if (elapsed > this.config.executionTimeoutMs) {
            throw new Error(`Execution timeout: ${handlerName} exceeded ${this.config.executionTimeoutMs}ms`)
        }
    }

    canContinue(): boolean {
        return this.safetyLevel !== SafetyLevel.EMERGENCY && this.health !== RuntimeHealth.SHUTDOWN
    }
}

export class ExecutionTimeoutEnforcer {
    private timeouts = new Map<string, { start: number; limit: number }>()

    start(name: string, limitMs: number): void {
        this.timeouts.set(name, { start: Date.now(), limit: limitMs })
    }

    check(name: string): boolean {
        const entry = this.timeouts.get(name)
        if (!entry) return true

        const elapsed = Date.now() - entry.start
        if (elapsed > entry.limit) {
            this.timeouts.delete(name)
            return false
        }
        return true
    }

    end(name: string): void {
        this.timeouts.delete(name)
    }
}

export function createSafetyGuards(client: RuntimeClient, config?: Partial<SafetyConfig>): LiveRuntimeSafetyGuards {
    return new LiveRuntimeSafetyGuards(client, config)
}