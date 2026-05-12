export interface BackoffConfig {
    initialDelay: number
    multiplier: number
    maxDelay: number
    maxAttempts: number
    resetOnSuccess: boolean
}

export class ExponentialBackoff {
    private config: BackoffConfig
    private currentAttempt = 0
    private currentDelay: number
    private lastAttemptTime: number | null = null
    private lastAttemptReason: string | null = null
    private isActive = false

    constructor(config: Partial<BackoffConfig> = {}) {
        this.config = {
            initialDelay: 1500,
            multiplier: 2,
            maxDelay: 60000,
            maxAttempts: 0,
            resetOnSuccess: true,
            ...config
        }
        this.currentDelay = this.config.initialDelay
    }

    getState(): {
        attempt: number
        delay: number
        isActive: boolean
        lastReason: string | null
    } {
        return {
            attempt: this.currentAttempt,
            delay: this.currentDelay,
            isActive: this.isActive,
            lastReason: this.lastAttemptReason
        }
    }

    startAttempt(reason: string): void {
        this.lastAttemptReason = reason
        this.lastAttemptTime = Date.now()
        this.currentAttempt++
        this.isActive = true
    }

    getNextDelay(): number {
        const delay = this.currentDelay
        this.currentDelay = Math.min(
            this.currentDelay * this.config.multiplier,
            this.config.maxDelay
        )
        return delay
    }

    reset(): void {
        this.currentAttempt = 0
        this.currentDelay = this.config.initialDelay
        this.lastAttemptTime = null
        this.lastAttemptReason = null
        this.isActive = false
    }

    shouldReconnect(): boolean {
        return this.config.maxAttempts === 0 || 
               this.currentAttempt < this.config.maxAttempts
    }

    onSuccessfulConnect(): void {
        if (this.config.resetOnSuccess) {
            this.reset()
        } else {
            this.isActive = false
        }
    }

    getBackoffDelay(): number {
        if (!this.shouldReconnect()) {
            return -1
        }
        return this.getNextDelay()
    }
}