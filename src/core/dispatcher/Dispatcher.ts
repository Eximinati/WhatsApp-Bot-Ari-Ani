import type { RuntimeEvent } from '../event-bus/types.js'
import type { MiddlewareContext } from '../middleware/types.js'
import type { IDispatcher, DispatcherHealth } from './types.js'
import type { EventType } from '../event-bus/types.js'

export abstract class BaseDispatcher implements IDispatcher {
    abstract readonly name: string
    abstract readonly eventType: EventType
    get priority(): number { return 0 }

    protected _eventsProcessed = 0
    protected _errorsCount = 0
    protected _lastEventAt: number | null = null
    protected _initialized = false

    async initialize(): Promise<void> {
        this._initialized = true
    }

    async shutdown(): Promise<void> {
        this._initialized = false
    }

    abstract handle(event: RuntimeEvent, context: MiddlewareContext): Promise<void>

    getHealth(): DispatcherHealth {
        return {
            status: this._errorsCount > 10 ? 'unhealthy' : this._errorsCount > 0 ? 'degraded' : 'healthy',
            lastEventAt: this._lastEventAt,
            eventsProcessed: this._eventsProcessed,
            errorsCount: this._errorsCount,
            metadata: {
                initialized: this._initialized
            }
        }
    }

    protected recordEvent(): void {
        this._eventsProcessed++
        this._lastEventAt = Date.now()
    }

    protected recordError(): void {
        this._errorsCount++
    }

    protected resetCounters(): void {
        this._eventsProcessed = 0
        this._errorsCount = 0
    }
}