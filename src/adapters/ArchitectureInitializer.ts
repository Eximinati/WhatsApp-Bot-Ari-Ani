import RuntimeClient from '../core/RuntimeClient.js'
import { createEventBus, EventType, type RuntimeEvent } from '../core/event-bus/index.js'
import { createMiddlewareChain, createInternalMiddlewareContext, MiddlewarePhase, type PipelineStatus } from '../core/middleware/index.js'
import { MessageDispatcher } from '../core/dispatcher/index.js'
import type { CommandDescriptor, CommandCapabilities } from '../core/dispatcher/types.js'
import { MessageSerializer } from '../core/serializer/index.js'
import { createServiceContainer } from '../core/service/index.js'
import { PerChatCircuitBreaker } from '../core/circuit-breaker/index.js'
import { LegacyRuntimeAdapter } from './legacy/LegacyRuntimeAdapter.js'
import { createHandlerRegistry } from '../core/handler/index.js'
import type { DispatcherHandler } from '../core/handler/types.js'
import { createTransaction, createTransportFacade, TransportCommitCoordinator, ExecutionTransaction as TxnExecutionTransaction } from '../core/transport/index.js'
import type { TransportIntent, PreCommitResult } from '../core/transport/types.js'
import { CommitDecision } from '../core/transport/types.js'
import { RuntimeTransportFacade } from '../core/transport/TransportFacade.js'
import { ExecutionCoordinator, type ExecutionResult } from '../core/execution/index.js'
import { RuntimeKernel, RuntimeMode, type ExecutionAuditRecord } from '../core/kernel/index.js'

export interface OwnershipDecision {
    shouldBypass: boolean
    canonical: string | null
    ownership: 'legacy' | 'dispatcher'
}

export enum ExecutionState {
    RECEIVED = 'RECEIVED',
    NORMALIZED = 'NORMALIZED',
    ROUTED = 'ROUTED',
    AUTHORIZED = 'AUTHORIZED',
    EXECUTING = 'EXECUTING',
    COMMITTED = 'COMMITTED',
    ABORTED = 'ABORTED',
    FAILED = 'FAILED'
}

export interface ExecutionTransaction {
    readonly id: string
    readonly canonical: string
    readonly state: ExecutionState
    readonly startTime: number
    readonly message: any
    readonly middleware: {
        allowed: boolean
        abortReason: string | null
    }
    readonly transport: {
        allowQuoted: boolean
        allowMedia: boolean
        allowEdits: boolean
    }
    readonly result: {
        success: boolean
        response: string | null
        error: string | null
    }
    commit(): Promise<void>
}

export interface ArchitectureContext {
    eventBus: ReturnType<typeof createEventBus>
    middlewareChain: ReturnType<typeof createMiddlewareChain>
    messageDispatcher: MessageDispatcher
    serializer: MessageSerializer
    container: ReturnType<typeof createServiceContainer>
    circuitBreaker: PerChatCircuitBreaker
    legacyAdapter: LegacyRuntimeAdapter
    executionCoordinator: ExecutionCoordinator
    runtimeKernel: RuntimeKernel | null
    runtimeMode: RuntimeMode
    bridgeListenerCount: number
    client: RuntimeClient
    transferOwnership: (command: string, owner: 'legacy' | 'dispatcher') => void
    getOwnership: (command: string) => 'legacy' | 'dispatcher'
    shouldBypassLegacy: (message: any) => OwnershipDecision
    getAuditLog: () => readonly ExecutionAuditRecord[]
    setRuntimeMode: (mode: RuntimeMode) => void
}

let architectureContext: ArchitectureContext | null = null

export function initializeArchitecture(client: RuntimeClient): ArchitectureContext {
    if (architectureContext) {
        return architectureContext
    }

    const eventBus = createEventBus()
    const middlewareChain = createMiddlewareChain()
    const messageDispatcher = new MessageDispatcher()
    const container = createServiceContainer()
    const circuitBreaker = new PerChatCircuitBreaker({
        failureThreshold: 10,
        successThreshold: 3,
        timeoutMs: 30_000
    })

    const handlerRegistry = createHandlerRegistry()
    for (const [command, handler] of handlerRegistry) {
        messageDispatcher.register({
            capabilities: {
                canonical: handler.name,
                aliases: handler.aliases || [],
                permissions: { ownerOnly: false, adminOnly: false, sudoOnly: false, selfOnly: false, privateOnly: false, groupOnly: false },
                cooldown: { scope: 'user', durationMs: 0, bypassOwner: false, bypassAdmin: false },
                flags: { disabled: false, maintenance: false, nsfw: false },
                transport: { allowQuoted: true, allowMedia: false, allowEdits: false }
            },
            execute: async (message: any, args: any, ctx: any) => {
                await handler.execute(ctx, message)
                return { success: true, response: undefined }
            }
        })
    }

    const serializer = new MessageSerializer({
        getGroupMetadata: async (jid: string) => {
            try {
                return await client.groupMetadata(jid)
            } catch {
                return null
            }
        },
        downloadMedia: async (message: unknown) => {
            const adapter = new LegacyRuntimeAdapter(client)
            const validated = adapter.safeNormalizeMedia(message)
            if (!validated) {
                return null
            }
            try {
                return await client.downloadMediaMessage(validated)
            } catch {
                return null
            }
        },
        getContact: (jid: string) => client.getContact(jid),
        getConfig: () => ({ prefix: client.config.prefix }),
        isMe: (jid: string) => client.isMe(jid)
    })

    const legacyAdapter = new LegacyRuntimeAdapter(client)

    const transferOwnership = (command: string, owner: 'legacy' | 'dispatcher'): void => {
        messageDispatcher.setOwnership(command, owner)
        client.log(`[ownership-transfer] ${command} -> ${owner}`)
    }

    const getOwnership = (command: string): 'legacy' | 'dispatcher' => {
        return messageDispatcher.getOwnership(command)
    }

    const shouldBypassLegacy = (message: any): OwnershipDecision => {
        const command = message.command
        if (!command) {
            return { shouldBypass: false, canonical: null, ownership: 'legacy' }
        }

        const canonical = messageDispatcher.resolveCanonical(command)
        if (!canonical) {
            return { shouldBypass: false, canonical: null, ownership: 'legacy' }
        }

        const ownership = messageDispatcher.getOwnership(canonical)
        return {
            shouldBypass: ownership === 'dispatcher',
            canonical,
            ownership
        }
    }

    const executionCoordinator = new ExecutionCoordinator(client, {
        capabilities: { allowQuoted: true, allowMedia: false, allowEdits: false, allowReactions: true, maxMediaSize: 16 * 1024 * 1024 }
    })

    transferOwnership('ping', 'dispatcher')
    transferOwnership('p', 'dispatcher')
    transferOwnership('help', 'dispatcher')
    transferOwnership('h', 'dispatcher')
    transferOwnership('hi', 'dispatcher')
    client.log('[ownership-activation] Migrated handlers now dispatcher-owned: ping, help, hi')

    const runtimeKernel = new RuntimeKernel(client, {
        mode: RuntimeMode.HYBRID,
        capabilities: { allowQuoted: true, allowMedia: false, allowEdits: false, allowReactions: true, maxMediaSize: 16 * 1024 * 1024 }
    })
    runtimeKernel.initialize().catch((e) => client.log(`[kernel] Init error: ${e}`))

    const setRuntimeMode = (mode: RuntimeMode) => {
        runtimeKernel.setMode(mode)
    }
    const getAuditLog = () => runtimeKernel.getAuditLog()

    let bridgeListenerCount = 0

    architectureContext = {
        eventBus,
        middlewareChain,
        messageDispatcher,
        serializer,
        container,
        circuitBreaker,
        legacyAdapter,
        executionCoordinator,
        runtimeKernel,
        runtimeMode: RuntimeMode.HYBRID,
        bridgeListenerCount,
        client,
        transferOwnership,
        getOwnership,
        shouldBypassLegacy,
        getAuditLog,
        setRuntimeMode
    }

    return architectureContext
}

export function getArchitectureContext(): ArchitectureContext | null {
    return architectureContext
}

function registerMiddlewareShadow(client: RuntimeClient, ctx: ArchitectureContext): void {
    ctx.eventBus.subscribe(
        EventType.RUNTIME_MESSAGE_RECEIVED,
        async (event: RuntimeEvent) => {
            try {
                const middlewareContext = createInternalMiddlewareContext(
                    event,
                    event.payload as unknown as import('../core/serializer/types.js').NormalizedMessage,
                    MiddlewarePhase.VALIDATION
                )

                const status = await ctx.middlewareChain.execute(middlewareContext)

                if (status.state !== 'completed' && status.state !== 'running') {
                    client.log(`Middleware shadow: ${event.type} → ${status.state} (${status.finalAbortReason?.code ?? 'unknown'})`)
                }
            } catch (error) {
                client.log(`Middleware shadow error: ${error instanceof Error ? error.message : String(error)}`)
            }
        },
        { priority: -1, name: 'middleware-shadow' }
    )

    registerDispatcherShadow(client, ctx)
}

function registerDispatcherShadow(client: RuntimeClient, ctx: ArchitectureContext): void {
    const configPrefix = '!'

    ctx.eventBus.subscribe(
        EventType.RUNTIME_MESSAGE_RECEIVED,
        async (event: RuntimeEvent) => {
            try {
                const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
                const message = event.payload as ShadowMessage
                const startTime = Date.now()

                client.log(`[execution-start] ${executionId} received`)

                const parseResult = parseCommandIndependently(message.content, configPrefix)
                const canonical = parseResult.command

                if (!canonical || !ctx.messageDispatcher.isOwnedByDispatcher(canonical)) {
                    return
                }

                client.log(`[execution-authority] ${canonical} dispatcher-owned`)

                const metadataResult = resolveFromMetadata(canonical, ctx.messageDispatcher)

                if (!metadataResult.metadata) {
                    client.log(`[execution-failed] ${canonical} - no handler`)
                    return
                }

                const routingResult = evaluateRoutingMetadataAuthoritative(message, metadataResult, ctx)

                if (!routingResult.canExecute) {
                    client.log(`[execution-aborted] ${canonical} - ${routingResult.rejectionReason}`)
                    return
                }

                client.log(`[execution-authorized] ${canonical}`)

                const transportCaps = metadataResult.metadata.transport

                let executionState = ExecutionState.EXECUTING

                let execResult: { success: boolean; response?: string; error?: Error }

                try {
                    execResult = await ctx.messageDispatcher.executeCommand(
                        canonical,
                        message as any,
                        {
                            args: parseResult.args,
                            flags: [],
                            joined: parseResult.args.join(' '),
                            raw: message.content ?? ''
                        }
                    )

                    executionState = execResult.success ? ExecutionState.COMMITTED : ExecutionState.FAILED
                } catch (execError) {
                    executionState = ExecutionState.FAILED
                    execResult = { success: false, error: execError instanceof Error ? execError : new Error(String(execError)) }
                    client.log(`[execution-failed] ${canonical} - ${execResult.error?.message}`)
                }

                if (executionState === ExecutionState.COMMITTED) {
                    client.log(`[execution-complete] ${canonical} - response: ${execResult.response ?? '(none)'}`)
                }

                const executionDuration = Date.now() - startTime
                client.log(`[execution-stats] ${canonical} completed in ${executionDuration}ms`)

            } catch (error) {
                client.log(`[execution-failed] dispatcher error: ${error instanceof Error ? error.message : String(error)}`)
            }
        },
        { priority: -2, name: 'dispatcher-execution' }
    )
}

interface ShadowMessage {
    content: string | null
    command: string | null
    commandPrefix: string | null
    chatType: string
    isFromMe: boolean
    senderJid: string
    permissions?: { allowed: boolean }
    commandNotFound?: boolean
}

interface ParseResult {
    command: string | null
    args: readonly string[]
    prefix: string | null
}

interface RoutingResult {
    canExecute: boolean
    rejectionReason: string | null
    canonicalCommand: string | null
}

enum DivergenceType {
    NONE = 'none',
    PARSE_MISMATCH = 'PARSE_MISMATCH',
    ALIAS_MISMATCH = 'ALIAS_MISMATCH',
    HANDLER_MISMATCH = 'HANDLER_MISMATCH',
    PERMISSION_MISMATCH = 'PERMISSION_MISMATCH',
    COOLDOWN_MISMATCH = 'COOLDOWN_MISMATCH',
    EXECUTION_MISMATCH = 'EXECUTION_MISMATCH',
    REJECTION_REASON_MISMATCH = 'REJECTION_REASON_MISMATCH'
}

interface MetadataResolution {
    canonical: string | null
    metadata: CommandMetadata | null
}

interface CommandMetadata {
    canonical: string
    aliases: readonly string[]
    permissions: {
        ownerOnly: boolean
        adminOnly: boolean
        sudoOnly: boolean
        selfOnly: boolean
        privateOnly: boolean
        groupOnly: boolean
    }
    cooldown: {
        scope: 'user' | 'chat' | 'global'
        durationMs: number
        bypassOwner: boolean
        bypassAdmin: boolean
    }
    flags: {
        disabled: boolean
        maintenance: boolean
        nsfw: boolean
    }
    transport: {
        allowQuoted: boolean
        allowMedia: boolean
        allowEdits: boolean
    }
}

function resolveFromMetadata(
    command: string | null,
    dispatcher: { resolveCanonical(cmd: string): string | null; getDescriptor(cmd: string): CommandDescriptor | undefined }
): MetadataResolution {
    if (!command) {
        return { canonical: null, metadata: null }
    }

    const canonical = dispatcher.resolveCanonical(command)
    if (!canonical) {
        return { canonical: null, metadata: null }
    }

    const descriptor = dispatcher.getDescriptor(canonical)
    return { canonical, metadata: descriptor?.capabilities ?? null }
}

function detectMetadataDivergence(
    shadowCommand: string | null,
    canonicalCommand: string | null,
    legacyCommand: string | null,
    shadowCanExecute: boolean,
    legacyAllowed: boolean,
    legacyCommandNotFound: boolean
): DivergenceType {
    if (shadowCommand !== legacyCommand) {
        return DivergenceType.PARSE_MISMATCH
    }
    if (canonicalCommand !== legacyCommand) {
        return DivergenceType.ALIAS_MISMATCH
    }
    if (legacyCommandNotFound && shadowCanExecute) {
        return DivergenceType.EXECUTION_MISMATCH
    }
    return DivergenceType.NONE
}

function evaluateRoutingMetadataAuthoritative(
    message: ShadowMessage,
    metadata: MetadataResolution,
    ctx: ArchitectureContext
): RoutingResult {
    if (!metadata.canonical || !metadata.metadata) {
        return { canExecute: false, rejectionReason: 'handler-not-found', canonicalCommand: null }
    }

    const { permissions, flags } = metadata.metadata

    if (flags.disabled || flags.maintenance) {
        return { canExecute: false, rejectionReason: 'command-disabled', canonicalCommand: metadata.canonical }
    }

    if (permissions.privateOnly && message.chatType === 'group') {
        return { canExecute: false, rejectionReason: 'private-only', canonicalCommand: metadata.canonical }
    }

    if (permissions.groupOnly && message.chatType === 'dm') {
        return { canExecute: false, rejectionReason: 'group-only', canonicalCommand: metadata.canonical }
    }

    if (permissions.selfOnly && !message.isFromMe) {
        return { canExecute: false, rejectionReason: 'self-only', canonicalCommand: metadata.canonical }
    }

    if (message.chatType === 'group' && message.isFromMe && !permissions.selfOnly) {
        return { canExecute: false, rejectionReason: 'self-in-group', canonicalCommand: metadata.canonical }
    }

    return { canExecute: true, rejectionReason: null, canonicalCommand: metadata.canonical }
}

function parseCommandIndependently(
    text: string | null,
    configPrefix: string
): ParseResult {
    if (!text) {
        return { command: null, args: [], prefix: null }
    }

    const prefix = configPrefix
    const trimmed = text.trim()

    if (!trimmed.startsWith(prefix)) {
        return { command: null, args: [], prefix: null }
    }

    const rest = trimmed.slice(prefix.length).trim()
    const parts = rest.split(/\s+/)
    const command = parts[0]?.toLowerCase() ?? null
    const args: readonly string[] = parts.slice(1)

    return { command, args, prefix }
}

export function createEventBridge(client: RuntimeClient, ctx: ArchitectureContext): void {
    // PHASE 2A: Simplified to passive audit-only bridge
    // - Removed duplicate serialization (message normalized in index.ts)
    // - Removed dispatcher-shadow execution (kernel handles routing)
    // - Removed middleware-shadow execution (redundant validation)
    // - Now only emits audit events without processing
    // - Listener count tracked to prevent duplicate bridge registration

if (ctx.bridgeListenerCount > 0) {
        client.log(`[EventBridge] Already registered (${ctx.bridgeListenerCount}), skipping duplicate`)
        return
    }

const bridgeListeners: Array<{ event: string; handler: (arg: any) => void }> = []
    ;(client as any)._bridgeListeners = bridgeListeners

    const bridgeListener = async (M: unknown) => {
        const bridgeStart = performance.now()
        const simplified = M as import('../typings/message.js').ISimplifiedMessage
        const rawMessage = simplified?.WAMessage
        const validated = rawMessage ? ctx.legacyAdapter.safeNormalize(rawMessage) : null
        if (!validated) {
            return
        }

        const normStart = performance.now()
        const normalized = await ctx.serializer.normalize(validated)
        const normDuration = performance.now() - normStart
        ctx.serializer.setUserJid(client.user.jid)

        if (normalized.chatJid.includes('status')) return

        if (normalized.isFromMe) {
            const loopAllowed = ctx.circuitBreaker.allow(normalized.chatJid)
            if (!loopAllowed) {
                return
            }
        }

        const busStart = performance.now()
        await ctx.eventBus.emitRaw(
            EventType.RUNTIME_MESSAGE_RECEIVED,
            normalized,
            { source: 'audit-bridge' }
        )
        const busDuration = performance.now() - busStart

        const handlers = ctx.eventBus.getSubscriptions(EventType.RUNTIME_MESSAGE_RECEIVED)
        const totalDuration = performance.now() - bridgeStart

        if (totalDuration > 50) {
            client.log(`[EVENT_BRIDGE] audit: ${Math.round(totalDuration)}ms normalize=${Math.round(normDuration)}ms bus=${Math.round(busDuration)}ms handlers=${handlers.length}`)
        }
    }

    client.on('new-message', bridgeListener)
    bridgeListeners.push({ event: 'new-message', handler: bridgeListener })
    ctx.bridgeListenerCount++

    const groupHandler = async (event: any) => {
        await ctx.eventBus.emitRaw(
            EventType.RUNTIME_GROUP_EVENT,
            { jid: event.jid, action: event.action, participants: event.participants, actor: event.actor || null },
            { source: 'legacy-bridge' }
        )
    }
    client.on('group-participants-update', groupHandler)
    bridgeListeners.push({ event: 'group-participants-update', handler: groupHandler })
    ctx.bridgeListenerCount++

    const callHandler = async (data: any) => {
        await ctx.eventBus.emitRaw(EventType.RUNTIME_CALL_INCOMING, data, { source: 'legacy-bridge' })
    }
    client.on('incoming-call', callHandler)
    bridgeListeners.push({ event: 'incoming-call', handler: callHandler })
    ctx.bridgeListenerCount++

    client.log(`[EventBridge] Registered ${ctx.bridgeListenerCount} listeners`)
}

export async function shutdownArchitecture(): Promise<void> {
    if (!architectureContext) return

    const ctx = architectureContext
    const archClient = ctx.client
    const listeners = (archClient as any)._bridgeListeners
    if (listeners && Array.isArray(listeners)) {
        for (const { event, handler } of listeners) {
            try { archClient.removeListener(event, handler) } catch { /* ignore */ }
        }
        ;(archClient as any)._bridgeListeners = []
        ctx.client.log('[EventBridge] Cleanup verified on shutdown')
    }

    if (ctx.eventBus) ctx.eventBus.clearHistory()
    if (ctx.middlewareChain) ctx.middlewareChain.clearDiagnostics()

    await ctx.messageDispatcher.shutdown()
    await ctx.container.shutdown()

    architectureContext = null
}