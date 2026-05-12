import type RuntimeClient from '../RuntimeClient.js'
import type { NormalizedMessage } from '../serializer/types.js'
import type { ParsedArgs } from '../middleware/types.js'
import { createEventBus, EventType, type RuntimeEvent } from '../event-bus/index.js'
import { createMiddlewareChain, MiddlewarePhase } from '../middleware/index.js'
import { MessageDispatcher } from '../dispatcher/index.js'
import type { CommandDescriptor } from '../dispatcher/types.js'
import { ExecutionCoordinator, type ExecutionResult, ExecutionPhase } from '../execution/index.js'
import { createServiceContainer } from '../service/index.js'
import { PerChatCircuitBreaker } from '../circuit-breaker/index.js'
import { MessageSerializer } from '../serializer/index.js'
import { LegacyRuntimeAdapter } from '../../adapters/legacy/LegacyRuntimeAdapter.js'
import { createHandlerRegistry } from '../handler/index.js'
import { CommitDecision, type TransportCapabilities, type TransportIntent, TransportCommitCoordinator } from '../transport/index.js'
import { StateManager } from '../state/index.js'
import { createDeterministicLiveClock, getNextAuditId } from '../execution/DeterministicClock.js'

export enum RuntimeMode {
    HYBRID = 'HYBRID',
    DISPATCHER_ONLY = 'DISPATCHER_ONLY',
    LEGACY_ONLY = 'LEGACY_ONLY'
}

export interface RuntimeKernelConfig {
    mode: RuntimeMode
    capabilities: TransportCapabilities
    maxRetries?: number
    timeoutMs?: number
}

export interface ExecutionAuditRecord {
    readonly executionId: string
    readonly transactionId: string
    readonly command: string
    readonly phase: ExecutionPhase
    readonly transitions: readonly { from: ExecutionPhase; to: ExecutionPhase; tick: number }[]
    readonly intents: readonly TransportIntent[]
    readonly commitDecision: CommitDecision
    readonly finalStateHash: string
    readonly durationMs: number
    readonly finalizedTick: number
    readonly success: boolean
    readonly ownership: 'dispatcher' | 'legacy'
    readonly error?: Error
}

export interface RuntimeKernelConfig {
    mode: RuntimeMode
    capabilities: TransportCapabilities
    maxRetries?: number
    timeoutMs?: number
    enableStateSnapshots?: boolean
}

export class RuntimeKernel {
    private readonly client: RuntimeClient
    private readonly config: RuntimeKernelConfig
    private readonly eventBus: ReturnType<typeof createEventBus>
    private readonly middlewareChain: ReturnType<typeof createMiddlewareChain>
    private readonly messageDispatcher: MessageDispatcher
    private readonly executionCoordinator: ExecutionCoordinator
    private readonly container: ReturnType<typeof createServiceContainer>
    private readonly circuitBreaker: PerChatCircuitBreaker
    private readonly serializer: MessageSerializer
    private readonly legacyAdapter: LegacyRuntimeAdapter
    private readonly auditLog: ExecutionAuditRecord[] = []
    private readonly maxAuditSize = 1000
    private runtimeMode: RuntimeMode
    private readonly stateManager: StateManager
    private readonly deterministicClock: ReturnType<typeof createDeterministicLiveClock>
    private auditTickCounter = 0
    private readonly chatExecutionLocks = new Map<string, Promise<void>>()

    constructor(client: RuntimeClient, config: RuntimeKernelConfig) {
        this.client = client
        this.config = config
        this.runtimeMode = config.mode
        this.eventBus = createEventBus()
        this.middlewareChain = createMiddlewareChain()
        this.messageDispatcher = new MessageDispatcher()
        this.deterministicClock = createDeterministicLiveClock()
        this.stateManager = new StateManager({
            snapshotRetention: config.maxRetries ?? 100
        })
        const commitCoordinator = new TransportCommitCoordinator(client, config.capabilities)
        this.executionCoordinator = new ExecutionCoordinator(client, {
            capabilities: config.capabilities,
            maxRetries: config.maxRetries,
            timeoutMs: config.timeoutMs,
            lifecycleCallbacks: {
                onPreCommit: async (transaction) => {
                    return { decision: CommitDecision.ALLOW, denialReason: undefined }
                },
                onCommit: async (transaction, intents) => {
                    if (intents.length === 0) return true
                    await commitCoordinator.commit(transaction.id, intents)
                    return true
                },
                onPostCommit: async (transaction, success) => {
                    this.client.log(`[kernel] Post-commit: ${transaction.id}, success: ${success}`)
                }
            }
        })
        this.container = createServiceContainer()
        this.circuitBreaker = new PerChatCircuitBreaker({
            failureThreshold: 10,
            successThreshold: 3,
            timeoutMs: 30_000
        })
        this.legacyAdapter = new LegacyRuntimeAdapter(client)
        this.serializer = new MessageSerializer({
            getGroupMetadata: async (jid: string) => {
                try {
                    return await client.groupMetadata(jid)
                } catch {
                    return null
                }
            },
            downloadMedia: async (message: unknown) => {
                const validated = this.legacyAdapter.safeNormalizeMedia(message)
                if (!validated) return null
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
    }

    async initialize(): Promise<void> {
        this.autoRegisterHandlers()
        this.setupEventBridge()
        this.client.log(`[kernel] Initialized in ${this.config.mode} mode`)
    }

    private autoRegisterHandlers(): void {
        const registry = createHandlerRegistry()
        for (const [command, handler] of registry) {
            const descriptor: CommandDescriptor = {
                capabilities: {
                    canonical: handler.name,
                    aliases: handler.aliases || [],
                    permissions: { ownerOnly: false, adminOnly: false, sudoOnly: false, selfOnly: false, privateOnly: false, groupOnly: false },
                    cooldown: { scope: 'user', durationMs: 0, bypassOwner: false, bypassAdmin: false },
                    flags: { disabled: false, maintenance: false, nsfw: false },
                    transport: { allowQuoted: true, allowMedia: false, allowEdits: false }
                },
                execute: async (message, args, ctx) => {
                    await handler.execute(ctx, message)
                    return { success: true }
                }
            }
            this.messageDispatcher.register(descriptor)
            this.messageDispatcher.setOwnership(handler.name, 'dispatcher')
            if (handler.aliases) {
                for (const alias of handler.aliases) {
                    this.messageDispatcher.setOwnership(alias, 'dispatcher')
                }
            }
        }
        this.client.log(`[kernel] Auto-registered ${registry.size} handlers`)
    }

    private setupEventBridge(): void {
        this.eventBus.subscribe(
            EventType.RUNTIME_MESSAGE_RECEIVED,
            async (event: RuntimeEvent) => {
                const payload = event.payload as { command?: string } | null
                this.emitAudit({
                    executionId: getNextAuditId(),
                    transactionId: '',
                    command: payload?.command || 'unknown',
                    phase: ExecutionPhase.CREATED,
                    transitions: [],
                    intents: [],
                    commitDecision: CommitDecision.ALLOW,
                    finalStateHash: '',
                    durationMs: 0,
                    finalizedTick: this.auditTickCounter++,
                    success: false,
                    ownership: 'legacy'
                })
            },
            { priority: -1, name: 'kernel-audit' }
        )
    }

    private emitAudit(record: ExecutionAuditRecord): void {
        const auditTick = ++this.auditTickCounter
        const auditRecord = { ...record, finalizedTick: auditTick }
        this.auditLog.push(Object.freeze(auditRecord))
        if (this.auditLog.length > this.maxAuditSize) {
            this.auditLog.shift()
        }
    }

    async handleMessage(message: NormalizedMessage): Promise<ExecutionResult | null> {
        if (this.runtimeMode === RuntimeMode.LEGACY_ONLY) {
            return null
        }

        const chatJid = message.chatJid
        const existingLock = this.chatExecutionLocks.get(chatJid)
        if (existingLock) {
            await existingLock
        }

        let releaseLock: () => void
        const executionPromise = new Promise<void>(resolve => {
            releaseLock = () => {
                this.chatExecutionLocks.delete(chatJid)
                resolve()
            }
        })
        this.chatExecutionLocks.set(chatJid, executionPromise)

        try {
            return await this.executeMessage(message)
        } finally {
            releaseLock!()
        }
    }

    private async executeMessage(message: NormalizedMessage): Promise<ExecutionResult | null> {
        const canonical = this.messageDispatcher.resolveCanonical(message.command || '')
        if (!canonical) {
            if (this.runtimeMode === RuntimeMode.DISPATCHER_ONLY) {
                return null
            }
            return null
        }

        const ownership = this.messageDispatcher.getOwnership(canonical)
        if (ownership === 'legacy') {
            if (this.runtimeMode === RuntimeMode.DISPATCHER_ONLY) {
                return null
            }
            return null
        }

        const descriptor = this.messageDispatcher.getDescriptor(canonical)
        if (!descriptor) {
            this.client.log(`[kernel] No descriptor for ${canonical}`)
            return null
        }

        const args: ParsedArgs = {
            args: message.args,
            flags: [],
            joined: message.args.join(' '),
            raw: message.args.join(' ')
        }

        const executionId = `exec-${this.deterministicClock.tick()}`
        const preSnapshot = this.stateManager.createInitialSnapshot(executionId)
        
        const result = await this.executionCoordinator.execute(descriptor, message, args)

        if (result.executionId) {
            this.stateManager.evolveSnapshot(preSnapshot, {
                executionId: result.executionId
            })
        }

        this.emitAudit({
            executionId: result.executionId,
            transactionId: result.transactionId,
            command: canonical,
            phase: result.phase,
            transitions: result.transitions,
            intents: result.intents,
            commitDecision: result.commitDecision,
            finalStateHash: result.finalStateHash,
            durationMs: result.durationMs,
            finalizedTick: result.finalizedTick,
            success: result.success,
            ownership: 'dispatcher',
            error: result.error
        })

        return result
    }

    getAuditLog(): readonly ExecutionAuditRecord[] {
        return Object.freeze([...this.auditLog])
    }

    getDispatcher(): MessageDispatcher {
        return this.messageDispatcher
    }

    getEventBus(): ReturnType<typeof createEventBus> {
        return this.eventBus
    }

    getMiddlewareChain(): ReturnType<typeof createMiddlewareChain> {
        return this.middlewareChain
    }

    getSerializer(): MessageSerializer {
        return this.serializer
    }

    getMode(): RuntimeMode {
        return this.runtimeMode
    }

    setMode(mode: RuntimeMode): void {
        this.runtimeMode = mode
        this.client.log(`[kernel] Mode changed to ${mode}`)
    }

    getStateManager(): StateManager {
        return this.stateManager
    }

    getExecutionCoordinator(): import('../execution/ExecutionCoordinator.js').ExecutionCoordinator {
        return this.executionCoordinator
    }

    createExecutionSnapshot(executionId: string): import('../state/index.js').StateSnapshot {
        return this.stateManager.createInitialSnapshot(executionId)
    }
}