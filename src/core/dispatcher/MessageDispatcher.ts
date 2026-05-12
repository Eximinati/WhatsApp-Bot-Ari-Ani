import type { RuntimeEvent } from '../event-bus/types.js'
import type { MiddlewareContext, MiddlewareMetadata } from '../middleware/types.js'
import { MapMiddlewareMetadata } from '../middleware/types.js'
import type { IMessageDispatcher, CommandHandler, DispatcherHealth, CommandDescriptor, CommandCapabilities } from './types.js'
import { EventType } from '../event-bus/types.js'
import { BaseDispatcher } from './Dispatcher.js'
import type { NormalizedMessage } from '../serializer/types.js'
import type { ExecutionContext, TransportCapabilities } from '../transport/types.js'
import { createTransaction, createTransportFacade } from '../transport/index.js'
import { getNextExecutionId } from '../execution/DeterministicClock.js'

let dispatcherStartTimeCounter = 0

function getNextDeterministicStartTime(): number {
    return ++dispatcherStartTimeCounter
}

function deepFreeze<T>(obj: T): Readonly<T> {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            deepFreeze(obj[i])
        }
        return Object.freeze(obj) as Readonly<T>
    }

    const frozen: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
        frozen[key] = deepFreeze((obj as Record<string, unknown>)[key])
    }
    return Object.freeze(frozen) as Readonly<T>
}

function cloneCapabilities(input: CommandCapabilities): CommandCapabilities {
    return {
        canonical: input.canonical,
        aliases: [...(input.aliases ?? [])],
        permissions: { ...input.permissions },
        cooldown: { ...input.cooldown },
        flags: { ...input.flags },
        transport: { ...input.transport }
    }
}

const DEFAULT_CAPABILITIES: CommandCapabilities = Object.freeze({
    canonical: '',
    aliases: Object.freeze([]),
    permissions: Object.freeze({
        ownerOnly: false,
        adminOnly: false,
        sudoOnly: false,
        selfOnly: false,
        privateOnly: false,
        groupOnly: false
    }),
    cooldown: Object.freeze({
        scope: 'user',
        durationMs: 0,
        bypassOwner: false,
        bypassAdmin: false
    }),
    flags: Object.freeze({
        disabled: false,
        maintenance: false,
        nsfw: false
    }),
    transport: Object.freeze({
        allowQuoted: true,
        allowMedia: true,
        allowEdits: false
    })
})

export class MessageDispatcher extends BaseDispatcher implements IMessageDispatcher {
    readonly name = 'MessageDispatcher'
    readonly eventType = EventType.RUNTIME_MESSAGE_RECEIVED
    get priority(): number { return 10 }

    private descriptors = new Map<string, CommandDescriptor>()
    private canonicalIndex = new Map<string, string>()
    private featureEnabled: Map<string, boolean> = new Map()
    private ownership = new Map<string, 'legacy' | 'dispatcher'>()

    setOwnership(command: string, owner: 'legacy' | 'dispatcher'): void {
        this.ownership.set(command.toLowerCase(), owner)
    }

    getOwnership(command: string): 'legacy' | 'dispatcher' {
        return this.ownership.get(command.toLowerCase()) ?? 'legacy'
    }

    isOwnedByDispatcher(command: string): boolean {
        return this.getOwnership(command) === 'dispatcher'
    }

    async executeCommand(
        command: string,
        message: NormalizedMessage,
        parsedArgs: { args: readonly string[]; flags: readonly string[]; joined: string; raw: string }
    ): Promise<{ success: boolean; response?: string; error?: Error }> {
        const descriptor = this.getDescriptor(command)
        if (!descriptor) {
            return { success: false, error: new Error(`Command not found: ${command}`) }
        }

        const transaction = createTransaction()
        const transport = createTransportFacade(undefined, transaction)
        const capabilities: TransportCapabilities = {
            allowQuoted: descriptor.capabilities.transport?.allowQuoted ?? true,
            allowMedia: descriptor.capabilities.transport?.allowMedia ?? false,
            allowEdits: descriptor.capabilities.transport?.allowEdits ?? false,
            allowReactions: true,
            maxMediaSize: 16 * 1024 * 1024
        }

        const context: ExecutionContext = Object.freeze({
            message,
            executionId: getNextExecutionId(),
            startTime: getNextDeterministicStartTime(),
            transport,
            capabilities,
            metadata: new MapMiddlewareMetadata(),
            transaction
        })

        try {
            const result = await descriptor.execute(message, parsedArgs, context)
            return { success: result.success, response: result.response }
        } catch (err) {
            return { success: false, error: err instanceof Error ? err : new Error(String(err)) }
        }
    }

    register(descriptor: CommandDescriptor): void {
        const canonical = descriptor.capabilities.canonical.toLowerCase()

        const mergedCapabilities: CommandCapabilities = {
            canonical,
            aliases: [...(descriptor.capabilities.aliases ?? [])].map(a => a.toLowerCase()),
            permissions: {
                ...DEFAULT_CAPABILITIES.permissions,
                ...descriptor.capabilities.permissions
            },
            cooldown: {
                ...DEFAULT_CAPABILITIES.cooldown,
                ...descriptor.capabilities.cooldown
            },
            flags: {
                ...DEFAULT_CAPABILITIES.flags,
                ...descriptor.capabilities.flags
            },
            transport: {
                ...DEFAULT_CAPABILITIES.transport,
                ...descriptor.capabilities.transport
            }
        }

        const frozenCapabilities = deepFreeze(mergedCapabilities)

        if (process.env.NODE_ENV !== 'production') {
            if (!Object.isFrozen(frozenCapabilities)) {
                throw new Error(`Command capabilities not frozen: ${canonical}`)
            }
            if (!Object.isFrozen(frozenCapabilities.permissions)) {
                throw new Error(`Command permissions not frozen: ${canonical}`)
            }
            if (!Object.isFrozen(frozenCapabilities.cooldown)) {
                throw new Error(`Command cooldown not frozen: ${canonical}`)
            }
            if (!Object.isFrozen(frozenCapabilities.flags)) {
                throw new Error(`Command flags not frozen: ${canonical}`)
            }
            if (!Object.isFrozen(frozenCapabilities.transport)) {
                throw new Error(`Command transport not frozen: ${canonical}`)
            }
            if (!Object.isFrozen(frozenCapabilities.aliases)) {
                throw new Error(`Command aliases not frozen: ${canonical}`)
            }
        }

        const frozenDescriptor: CommandDescriptor = Object.freeze({
            capabilities: frozenCapabilities,
            execute: descriptor.execute
        })

        this.descriptors.set(canonical, frozenDescriptor)
        this.canonicalIndex.set(canonical, canonical)

        for (const alias of frozenCapabilities.aliases) {
            this.canonicalIndex.set(alias, canonical)
        }
    }

    unregister(command: string): boolean {
        const canonical = command.toLowerCase()
        const descriptor = this.descriptors.get(canonical)
        if (!descriptor) return false

        for (const alias of descriptor.capabilities.aliases) {
            this.canonicalIndex.delete(alias.toLowerCase())
        }
        this.canonicalIndex.delete(canonical)
        this.descriptors.delete(canonical)
        return true
    }

    getDescriptor(command: string): CommandDescriptor | undefined {
        const canonical = this.resolveCanonical(command)
        if (!canonical) return undefined
        return this.descriptors.get(canonical)
    }

    resolveCanonical(command: string): string | null {
        return this.canonicalIndex.get(command.toLowerCase()) ?? null
    }

    getAllDescriptors(): ReadonlyMap<string, CommandDescriptor> {
        return this.descriptors
    }

    getCommandHandler(command: string): CommandHandler | undefined {
        const descriptor = this.getDescriptor(command)
        return descriptor?.execute
    }

    registerCommandHandler(command: string, handler: CommandHandler, metadata?: Partial<CommandCapabilities>): void {
        this.register({
            capabilities: {
                canonical: command.toLowerCase(),
                aliases: [],
                permissions: { ownerOnly: false, adminOnly: false, sudoOnly: false, selfOnly: false, privateOnly: false, groupOnly: false },
                cooldown: { scope: 'user', durationMs: 0, bypassOwner: false, bypassAdmin: false },
                flags: { disabled: false, maintenance: false, nsfw: false },
                transport: { allowQuoted: true, allowMedia: true, allowEdits: false },
                ...metadata
            },
            execute: handler
        })
    }

    unregisterCommandHandler(command: string): boolean {
        return this.unregister(command)
    }

    getCommandMetadata(command: string): CommandCapabilities | undefined {
        return this.getDescriptor(command)?.capabilities
    }

    getAllCommandMetadata(): ReadonlyMap<string, CommandCapabilities> {
        const result = new Map<string, CommandCapabilities>()
        for (const [key, desc] of this.descriptors) {
            result.set(key, desc.capabilities)
        }
        return result
    }

    setFeatureState(feature: string, enabled: boolean): void {
        this.featureEnabled.set(feature, enabled)
    }

    isFeatureEnabled(feature: string): boolean {
        return this.featureEnabled.get(feature) ?? false
    }

    async handle(event: RuntimeEvent, context: MiddlewareContext): Promise<void> {
        this.recordEvent()

        try {
            const message = context.message

            if (!message.command) {
                context.result = { success: true }
                return
            }

            const handler = this.getCommandHandler(message.command)
            if (!handler) {
                context.result = {
                    success: false,
                    error: new Error(`Command not found: ${message.command}`)
                }
                return
            }

            const parsedArgs = context.parsedArgs
            if (!parsedArgs) {
                context.result = {
                    success: false,
                    error: new Error('No parsed args in context')
                }
                return
            }

            const transaction = createTransaction()
            const transport = createTransportFacade(undefined, transaction)
            const capabilities: TransportCapabilities = {
                allowQuoted: true,
                allowMedia: false,
                allowEdits: false,
                allowReactions: true,
                maxMediaSize: 16 * 1024 * 1024
            }

            const execContext: ExecutionContext = Object.freeze({
                message,
                executionId: context.executionId,
                startTime: context.startTime,
                transport,
                capabilities,
                metadata: context.metadata,
                transaction
            })

            const result = await handler(message, parsedArgs, execContext)
            context.result = result
        } catch (error) {
            this.recordError()
            context.result = {
                success: false,
                error: error instanceof Error ? error : new Error(String(error))
            }
            context.aborted = true
            context.abortReason = {
                code: 'MIDDLEWARE_ERROR',
                message: error instanceof Error ? error.message : String(error)
            }
        }
    }

    getHealth(): DispatcherHealth {
        return {
            ...super.getHealth(),
            metadata: {
                ...super.getHealth().metadata,
                registeredCommands: this.descriptors.size,
                enabledFeatures: this.featureEnabled.size
            }
        }
    }
}