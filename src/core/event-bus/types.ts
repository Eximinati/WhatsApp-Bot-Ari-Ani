export enum EventDomain {
    TRANSPORT = 'transport',
    RUNTIME = 'runtime',
    FEATURE = 'feature',
    SYSTEM = 'system'
}

export enum EventType {
    TRANSPORT_CONNECTED = 'transport.connected',
    TRANSPORT_DISCONNECTED = 'transport.disconnected',
    TRANSPORT_ERROR = 'transport.error',
    TRANSPORT_MESSAGE_RAW = 'transport.message.raw',

    RUNTIME_MESSAGE_RECEIVED = 'runtime.message.received',
    RUNTIME_MESSAGE_SENT = 'runtime.message.sent',
    RUNTIME_COMMAND_EXECUTED = 'runtime.command.executed',
    RUNTIME_GROUP_EVENT = 'runtime.group.event',
    RUNTIME_CALL_INCOMING = 'runtime.call.incoming',
    RUNTIME_PRESENCE_UPDATED = 'runtime.presence.updated',

    FEATURE_ENABLED = 'feature.enabled',
    FEATURE_DISABLED = 'feature.disabled',
    FEATURE_EVENT = 'feature.event',

    SYSTEM_STARTUP = 'system.startup',
    SYSTEM_SHUTDOWN = 'system.shutdown',
    SYSTEM_ERROR = 'system.error',
    SYSTEM_HEALTH_CHECK = 'system.health.check',
    SYSTEM_METRICS = 'system.metrics'
}

export function getEventDomain(type: EventType): EventDomain {
    const prefix = type.split('.')[0]

    switch (prefix) {
        case 'transport':
            return EventDomain.TRANSPORT
        case 'runtime':
            return EventDomain.RUNTIME
        case 'feature':
            return EventDomain.FEATURE
        case 'system':
            return EventDomain.SYSTEM
        default:
            return EventDomain.SYSTEM
    }
}

export interface EventMetadata {
    readonly source?: string
    readonly traceId?: string
    readonly parentEventId?: string
    readonly [key: string]: unknown
}

export interface RuntimeEvent<T = unknown> {
    readonly id: string
    readonly domain: EventDomain
    readonly type: EventType
    readonly timestamp: number
    readonly payload: T
    readonly metadata: Readonly<EventMetadata>
}

export interface EventHandler<T = unknown> {
    (event: RuntimeEvent<T>): Promise<void> | void
}

export interface SubscribeOptions {
    priority?: number
    name?: string
}

export interface Subscription {
    readonly id: string
    readonly eventType: EventType
    readonly handler: EventHandler
    readonly priority: number

    unsubscribe(): void
}

export interface EmitResult {
    readonly success: boolean
    readonly eventId: string
    readonly errorCount: number
    readonly errors: readonly EmitError[]
}

export interface EmitError {
    readonly subscriptionId: string
    readonly handlerName?: string
    readonly error: Error
}

export interface SubscribeOptions {
    priority?: number
    name?: string
    timeoutMs?: number
}

export const DEFAULT_SUBSCRIBER_TIMEOUT_MS = 30_000
export const MAX_SUBSCRIBERS_PER_EVENT = 50
export const MAX_EVENT_HISTORY = 100