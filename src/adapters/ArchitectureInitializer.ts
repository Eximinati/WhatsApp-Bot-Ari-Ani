import RuntimeClient from '../core/RuntimeClient.js'
import { createEventBus, EventType } from '../core/event-bus/index.js'
import { MessageSerializer } from '../core/serializer/index.js'
import { PerChatCircuitBreaker } from '../core/circuit-breaker/index.js'
import { LegacyRuntimeAdapter } from './legacy/LegacyRuntimeAdapter.js'

export interface ArchitectureContext {
    eventBus: ReturnType<typeof createEventBus>
    serializer: MessageSerializer
    circuitBreaker: PerChatCircuitBreaker
    legacyAdapter: LegacyRuntimeAdapter
    bridgeListenerCount: number
    client: RuntimeClient
}

let architectureContext: ArchitectureContext | null = null

export function initializeArchitecture(client: RuntimeClient): ArchitectureContext {
    if (architectureContext) {
        return architectureContext
    }

    const eventBus = createEventBus()
    const circuitBreaker = new PerChatCircuitBreaker({
        failureThreshold: 10,
        successThreshold: 3,
        timeoutMs: 30_000
    })

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

    let bridgeListenerCount = 0

    architectureContext = {
        eventBus,
        serializer,
        circuitBreaker,
        legacyAdapter,
        bridgeListenerCount,
        client
    }

    return architectureContext
}

export function getArchitectureContext(): ArchitectureContext | null {
    return architectureContext
}

export function createEventBridge(client: RuntimeClient, ctx: ArchitectureContext): void {
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

    architectureContext = null
}
