import type { EventType, RuntimeEvent } from '../event-bus/types.js'
import type { MiddlewareContext } from '../middleware/types.js'
import type { NormalizedMessage } from '../serializer/types.js'
import type { ExecutionContext } from '../transport/types.js'

export interface DispatcherHealth {
    status: 'healthy' | 'degraded' | 'unhealthy'
    lastEventAt: number | null
    eventsProcessed: number
    errorsCount: number
    metadata?: Record<string, unknown>
}

export interface IDispatcher {
    readonly name: string
    readonly eventType: EventType
    readonly priority: number

    initialize(): Promise<void>
    shutdown(): Promise<void>

    handle(event: RuntimeEvent, context: MiddlewareContext): Promise<void>

    getHealth(): DispatcherHealth
}

export interface CommandCapabilities {
    readonly canonical: string
    readonly aliases: readonly string[]
    readonly permissions: {
        readonly ownerOnly: boolean
        readonly adminOnly: boolean
        readonly sudoOnly: boolean
        readonly selfOnly: boolean
        readonly privateOnly: boolean
        readonly groupOnly: boolean
    }
    readonly cooldown: {
        readonly scope: 'user' | 'chat' | 'global'
        readonly durationMs: number
        readonly bypassOwner: boolean
        readonly bypassAdmin: boolean
    }
    readonly flags: {
        readonly disabled: boolean
        readonly maintenance: boolean
        readonly nsfw: boolean
    }
    readonly transport: {
        readonly allowQuoted: boolean
        readonly allowMedia: boolean
        readonly allowEdits: boolean
    }
}

export interface CommandHandler {
    (
        message: NormalizedMessage,
        parsedArgs: import('../middleware/types.js').ParsedArgs,
        context: ExecutionContext
    ): Promise<import('../middleware/types.js').HandlerResult>
}

export interface CommandDescriptor {
    readonly capabilities: CommandCapabilities
    readonly execute: CommandHandler
}

export interface IMessageDispatcher extends IDispatcher {
    register(descriptor: CommandDescriptor): void
    unregister(command: string): boolean
    getDescriptor(command: string): CommandDescriptor | undefined
    resolveCanonical(command: string): string | null
    getAllDescriptors(): ReadonlyMap<string, CommandDescriptor>

    registerCommandHandler(command: string, handler: CommandHandler, metadata?: Partial<CommandCapabilities>): void
    unregisterCommandHandler(command: string): boolean
    getCommandHandler(command: string): CommandHandler | undefined
    getCommandMetadata(command: string): CommandCapabilities | undefined
    getAllCommandMetadata(): ReadonlyMap<string, CommandCapabilities>
}

export interface IGroupDispatcher extends IDispatcher {}

export interface ICallDispatcher extends IDispatcher {}

export interface IPresenceDispatcher extends IDispatcher {}