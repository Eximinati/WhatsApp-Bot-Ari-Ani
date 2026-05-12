import type {
    EventType,
    RuntimeEvent,
    EventHandler,
    SubscribeOptions,
    Subscription,
    EventDomain,
    EventMetadata,
    EmitResult,
    EmitError
} from './types.js'
import { getEventDomain, DEFAULT_SUBSCRIBER_TIMEOUT_MS, MAX_SUBSCRIBERS_PER_EVENT, MAX_EVENT_HISTORY } from './types.js'

const MAX_EMIT_QUEUE = 100

type SubscriptionEntry = Subscription & {
    boundHandler: EventHandler
    timeoutMs: number
    name?: string
}

let eventIdCounter = 0
let eventTimestampCounter = 0

function generateEventId(): string {
    return `evt-${++eventIdCounter}`
}

function getNextEventTimestamp(): number {
    return ++eventTimestampCounter
}

export class EventBus {
    private subscriptions = new Map<EventType, SubscriptionEntry[]>()
    private eventHistory: RuntimeEvent[] = []
    private emitting = false
    private emitQueue: Array<() => Promise<void>> = []
    private processingQueue = false

    private generateId(): string {
        return generateEventId()
    }

    subscribe<T = unknown>(
        eventType: EventType,
        handler: EventHandler<T>,
        options: SubscribeOptions = {}
    ): Subscription {
        const priority = options.priority ?? 0

        const existing = this.subscriptions.get(eventType) || []
        if (existing.length >= MAX_SUBSCRIBERS_PER_EVENT) {
            throw new Error(`Max subscribers (${MAX_SUBSCRIBERS_PER_EVENT}) exceeded for event ${eventType}`)
        }

        const subscription: Subscription = {
            id: this.generateId(),
            eventType,
            handler: handler as EventHandler,
            priority,
            unsubscribe: () => this.unsubscribe(subscription)
        }

        const entry: SubscriptionEntry = {
            ...subscription,
            boundHandler: handler as EventHandler,
            timeoutMs: options.timeoutMs ?? DEFAULT_SUBSCRIBER_TIMEOUT_MS,
            name: options.name
        }

        existing.push(entry)
        existing.sort((a, b) => b.priority - a.priority)
        this.subscriptions.set(eventType, existing)

        return subscription
    }

    unsubscribe(subscription: Subscription): void {
        const existing = this.subscriptions.get(subscription.eventType)
        if (!existing) return

        const filtered = existing.filter(s => s.id !== subscription.id)

        if (filtered.length === 0) {
            this.subscriptions.delete(subscription.eventType)
        } else {
            this.subscriptions.set(subscription.eventType, filtered)
        }
    }

    async emit<T = unknown>(event: RuntimeEvent<T>): Promise<EmitResult> {
        if (this.emitting) {
            if (this.emitQueue.length >= MAX_EMIT_QUEUE) {
                return {
                    success: false,
                    eventId: event.id,
                    errorCount: 1,
                    errors: [{
                        subscriptionId: 'QUEUE_LIMIT',
                        error: new Error('Emit queue full')
                    }]
                }
            }
            this.emitQueue.push(async () => {
                await this.doEmit(event)
            })
            return {
                success: true,
                eventId: event.id,
                errorCount: 0,
                errors: []
            }
        }

        return this.doEmit(event)
    }

    private async doEmit<T = unknown>(event: RuntimeEvent<T>): Promise<EmitResult> {
        this.emitting = true
        this.addToHistory(event)

        const errors: EmitError[] = []
        const subscriptions = [...(this.subscriptions.get(event.type) || [])]

        for (const sub of subscriptions) {
            const error = await this.executeWithTimeout(sub, event)
            if (error) {
                errors.push({
                    subscriptionId: sub.id,
                    handlerName: sub.name,
                    error
                })
            }
        }

        this.emitting = false
        await this.processQueue()

        return {
            success: errors.length === 0,
            eventId: event.id,
            errorCount: errors.length,
            errors
        }
    }

    private async executeWithTimeout<T>(sub: SubscriptionEntry, event: RuntimeEvent<T>): Promise<Error | null> {
        return new Promise<Error | null>((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve(new Error(`Handler timed out after ${sub.timeoutMs}ms`))
            }, sub.timeoutMs)

            try {
                const result = sub.boundHandler(event)
                if (result && typeof result.then === 'function') {
                    result.then(() => {
                        clearTimeout(timeoutId)
                        resolve(null)
                    }).catch((err: unknown) => {
                        clearTimeout(timeoutId)
                        resolve(err instanceof Error ? err : new Error(String(err)))
                    })
                } else {
                    clearTimeout(timeoutId)
                    resolve(null)
                }
            } catch (err) {
                clearTimeout(timeoutId)
                resolve(err instanceof Error ? err : new Error(String(err)))
            }
        })
    }

    private async processQueue(): Promise<void> {
        if (this.processingQueue || this.emitQueue.length === 0) return
        this.processingQueue = true

        while (this.emitQueue.length > 0) {
            const task = this.emitQueue.shift()
            if (task) await task()
        }

        this.processingQueue = false
    }

    async emitRaw<T = unknown>(
        type: EventType,
        payload: T,
        metadata: EventMetadata = {}
    ): Promise<EmitResult> {
        const domain = getEventDomain(type)

        const event: RuntimeEvent<T> = {
            id: this.generateId(),
            domain,
            type,
            timestamp: getNextEventTimestamp(),
            payload,
            metadata
        }

        return this.emit(event)
    }

    getSubscribers(eventType: EventType): number {
        return (this.subscriptions.get(eventType) || []).length
    }

    getEventHistory(limit?: number): readonly RuntimeEvent[] {
        if (limit && limit > 0) {
            return this.eventHistory.slice(-limit)
        }
        return this.eventHistory
    }

    clearHistory(): void {
        this.eventHistory = []
    }

    getSubscriptions(eventType?: EventType): Subscription[] {
        if (eventType) {
            return (this.subscriptions.get(eventType) || []).map(s => ({
                id: s.id,
                eventType: s.eventType,
                handler: s.handler,
                priority: s.priority,
                unsubscribe: () => this.unsubscribe(s)
            }))
        }

        const all: Subscription[] = []
        for (const [type, subs] of this.subscriptions.entries()) {
            for (const s of subs) {
                all.push({
                    id: s.id,
                    eventType: type,
                    handler: s.handler,
                    priority: s.priority,
                    unsubscribe: () => this.unsubscribe(s)
                })
            }
        }
        return all
    }

    private addToHistory(event: RuntimeEvent): void {
        this.eventHistory.push(event)
        if (this.eventHistory.length > MAX_EVENT_HISTORY) {
            this.eventHistory.shift()
        }
    }

    getSubscriberCount(eventType?: EventType): number {
        if (eventType) {
            return (this.subscriptions.get(eventType) || []).length
        }
        let total = 0
        for (const subs of this.subscriptions.values()) {
            total += subs.length
        }
        return total
    }
}

let eventBusInstance: EventBus | null = null

export function getEventBus(): EventBus {
    if (!eventBusInstance) {
        eventBusInstance = new EventBus()
    }
    return eventBusInstance
}

export function createEventBus(): EventBus {
    return new EventBus()
}