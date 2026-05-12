import type {
    TransportFacade,
    TransportIntent,
    TransportResult,
    MediaPayload,
    TransportCapabilities,
    TransportOptions,
    CommitResult,
    TransactionCommitResult,
    PreCommitResult
} from './types.js'
import { TransportIntentType, CommitDecision } from './types.js'
import { createDeterministicLiveClock, type DeterministicClock } from '../execution/DeterministicClock.js'
import { ExecutionClock } from '../execution/ExecutionClock.js'

let intentIdCounter = 0
let globalGetSequence: (() => number) | undefined = undefined

export function setGlobalSequenceGetter(fn: (() => number) | undefined): void {
    globalGetSequence = fn
}

function generateIntentId(getSequence?: () => number): string {
    const seq = (getSequence ?? globalGetSequence)?.() ?? ++intentIdCounter
    return `intent-${seq.toString().padStart(6, '0')}`
}

export class RuntimeTransportFacade implements TransportFacade {
    private transactionRef: { get: () => ExecutionTransaction; set: (t: ExecutionTransaction) => void } | null = null
    private lineage: { parentId?: string; createdAtTick: number } = { createdAtTick: 0 }
    private getNextSequence: (() => number) | undefined
    private deterministicClock: DeterministicClock | null = null
    private readonly capabilities: TransportCapabilities

    constructor(
        capabilities: TransportCapabilities,
        getNextSequence?: () => number,
        clock?: DeterministicClock
    ) {
        this.capabilities = capabilities
        this.getNextSequence = getNextSequence
        this.deterministicClock = clock ?? createDeterministicLiveClock()
    }

    bindTransaction(getter: () => ExecutionTransaction, setter: (t: ExecutionTransaction) => void): void {
        this.transactionRef = { get: getter, set: setter }
    }

    setLineage(parentId?: string): void {
        this.lineage = { parentId, createdAtTick: this.deterministicClock?.getTick() ?? 0 }
    }

    getLineage(): { parentId?: string; createdAtTick: number } {
        return this.lineage
    }

    private createIntent(
        type: TransportIntent['type'],
        targetJid: string,
        payload?: TransportIntent['payload'],
        options?: TransportOptions
    ): TransportIntent {
        const currentTransaction = this.transactionRef?.get()
        const sequence = currentTransaction ? currentTransaction.sequence + 1 : 1

        return Object.freeze({
            id: generateIntentId(this.getNextSequence),
            sequence,
            type,
            targetJid,
            payload,
            options,
            createdAtTick: this.deterministicClock?.getTick() ?? 0
        })
    }

    private evolveTransaction(intent: TransportIntent): void {
        if (this.transactionRef) {
            const current = this.transactionRef.get()
            const next = current.appendIntent(intent)
            this.transactionRef.set(next)
        }
    }

    queueText(jid: string, text: string, options?: TransportOptions): TransportIntent {
        const intent = this.createIntent(TransportIntentType.SEND_TEXT, jid, { text }, options)
        this.evolveTransaction(intent)
        return intent
    }

    queueMedia(jid: string, media: MediaPayload, options?: TransportOptions): TransportIntent {
        if (!this.capabilities.allowMedia) {
            throw new Error('Media not allowed by capabilities')
        }
        const intent = this.createIntent(TransportIntentType.SEND_MEDIA, jid, { media }, options)
        this.evolveTransaction(intent)
        return intent
    }

    queueReaction(jid: string, messageId: string, emoji: string): TransportIntent {
        if (!this.capabilities.allowReactions) {
            throw new Error('Reactions not allowed by capabilities')
        }
        const intent = this.createIntent(TransportIntentType.REACT, jid, { reaction: emoji }, { quoted: messageId })
        this.evolveTransaction(intent)
        return intent
    }

    queueEdit(jid: string, messageId: string, newText: string): TransportIntent {
        if (!this.capabilities.allowEdits) {
            throw new Error('Edits not allowed by capabilities')
        }
        const intent = this.createIntent(TransportIntentType.EDIT, jid, { text: newText, editId: messageId })
        this.evolveTransaction(intent)
        return intent
    }

    queueDelete(jid: string, messageId: string): TransportIntent {
        const intent = this.createIntent(TransportIntentType.DELETE, jid, { deleteId: messageId })
        this.evolveTransaction(intent)
        return intent
    }

    queueQuote(jid: string, text: string, quotedMessageId: string): TransportIntent {
        if (!this.capabilities.allowQuoted) {
            throw new Error('Quoting not allowed by capabilities')
        }
        const intent = this.createIntent(TransportIntentType.QUOTE, jid, { text, quotedId: quotedMessageId })
        this.evolveTransaction(intent)
        return intent
    }

    queueTyping(jid: string, typing: boolean): TransportIntent {
        const intent = this.createIntent(TransportIntentType.TYPING, jid, { typing })
        this.evolveTransaction(intent)
        return intent
    }

    queuePresence(jid: string, presence: 'composing' | 'paused' | 'available'): TransportIntent {
        const intent = this.createIntent(TransportIntentType.PRESENCE, jid, { presence })
        this.evolveTransaction(intent)
        return intent
    }

    async downloadMedia(messageId: string): Promise<Buffer | null> {
        return null
    }

    getQueuedIntents(): readonly TransportIntent[] {
        return this.transactionRef?.get().transportIntents ?? []
    }

    clearIntents(): void {}
}

export class TransportCommitCoordinator {
    private clock: DeterministicClock | null = null

    constructor(
        private client: any,
        private capabilities: TransportCapabilities
    ) {}

    setClock(clock: DeterministicClock): void {
        this.clock = clock
    }

    async executePreCommit(
        transaction: ExecutionTransaction,
        middleware: (intents: readonly TransportIntent[]) => Promise<PreCommitResult>
    ): Promise<{ canCommit: boolean; result: TransactionCommitResult | null }> {
        const intents = transaction.transportIntents

        if (intents.length === 0) {
            return { canCommit: true, result: null }
        }

        const preCommitResult = await middleware(intents)
        const commitTick = this.clock?.getTick() ?? 0

        if (preCommitResult.decision === CommitDecision.DENY) {
            return {
                canCommit: false,
                result: {
                    transactionId: transaction.id,
                    results: preCommitResult.intents.map(intent => ({
                        success: false,
                        intentId: intent.id,
                        error: new Error(`Denied: ${preCommitResult.denialReason}`),
                        committedAt: commitTick
                    })),
                    success: false,
                    totalDurationMs: 0
                }
            }
        }

        const finalIntents = preCommitResult.decision === CommitDecision.REWRITE
            ? preCommitResult.intents
            : intents

        const commitResult = await this.commit(transaction.id, finalIntents)

        return { canCommit: commitResult.success, result: commitResult }
    }

    async commit(transactionId: string, intents: readonly TransportIntent[]): Promise<TransactionCommitResult> {
        const startTick = this.clock?.getTick() ?? 0
        const results: CommitResult[] = []

        const sorted = [...intents].sort((a, b) => a.sequence - b.sequence)

        for (const intent of sorted) {
            const result = await this.executeIntent(intent)
            results.push({
                success: result.success,
                intentId: intent.id,
                messageId: result.messageId,
                error: result.error,
                committedAt: this.clock?.getTick() ?? startTick
            })
        }

        const endTick = this.clock?.getTick() ?? startTick
        const totalDurationMs = endTick - startTick

        return {
            transactionId,
            results,
            success: results.every(r => r.success),
            totalDurationMs
        }
    }

    private async executeIntent(intent: TransportIntent): Promise<TransportResult> {
        try {
            switch (intent.type) {
                case TransportIntentType.SEND_TEXT: {
                    const result = await this.client.sendMessage(
                        intent.targetJid,
                        intent.payload?.text ?? '',
                        this.buildOptions(intent.options)
                    )
                    return { success: true, messageId: result?.key?.id }
                }
                case TransportIntentType.SEND_MEDIA: {
                    const media = intent.payload?.media
                    if (!media) return { success: false, error: new Error('No media payload') }
                    const result = await this.client.sendMessage(
                        intent.targetJid,
                        media.url ?? media.buffer,
                        { mediaType: media.type, mimetype: media.mimetype, caption: media.caption }
                    )
                    return { success: true, messageId: result?.key?.id }
                }
                case TransportIntentType.REACT: {
                    await this.client.sendMessage(intent.targetJid, {
                        reactionMessage: {
                            key: { id: intent.options?.quoted, remoteJid: intent.targetJid },
                            text: intent.payload?.reaction
                        }
                    })
                    return { success: true }
                }
                case TransportIntentType.DELETE: {
                    await this.client.sendMessage(intent.targetJid, {
                        delete: { id: intent.payload?.deleteId, remoteJid: intent.targetJid }
                    })
                    return { success: true }
                }
                case TransportIntentType.QUOTE: {
                    const result = await this.client.sendMessage(
                        intent.targetJid,
                        intent.payload?.text ?? '',
                        { quoted: { id: intent.payload?.quotedId, remoteJid: intent.targetJid } }
                    )
                    return { success: true, messageId: result?.key?.id }
                }
                case TransportIntentType.TYPING:
                case TransportIntentType.PRESENCE: {
                    await this.client.sendPresenceUpdate(
                        intent.payload?.presence ?? intent.payload?.typing ? 'composing' : 'paused',
                        intent.targetJid
                    )
                    return { success: true }
                }
                default:
                    return { success: false, error: new Error(`Unknown intent type: ${intent.type}`) }
            }
        } catch (err) {
            return { success: false, error: err instanceof Error ? err : new Error(String(err)) }
        }
    }

    private buildOptions(options?: TransportOptions): any {
        if (!options) return {}
        return {
            quoted: options.quoted ? { id: options.quoted } : undefined,
            contextInfo: options.contextInfo
        }
    }
}

export class ExecutionTransaction {
    private _intents: TransportIntent[] = []
    private _sequence: number = 0
    private _metadata: Map<string, unknown> = new Map()
    private _parentId?: string
    private _revision: number = 0
    private _finalized: boolean = false
    private _finalizedAtTick: number = 0
    private _intentsFrozen: readonly TransportIntent[] | null = null

    constructor(
        readonly id: string,
        readonly startTick: number = 0,
        parentId?: string
    ) {
        this._parentId = parentId
    }

    get startTime(): number {
        return this.startTick
    }

    get transportIntents(): readonly TransportIntent[] {
        if (this._intentsFrozen) {
            return this._intentsFrozen
        }
        return Object.freeze([...this._intents])
    }

    get sequence(): number {
        return this._sequence
    }

    get revision(): number {
        return this._revision
    }

    get isFinalized(): boolean {
        return this._finalized
    }

    get finalizedAtTick(): number {
        return this._finalizedAtTick
    }

    get metadata(): Map<string, unknown> {
        return new Map(this._metadata)
    }

    get parentId(): string | undefined {
        return this._parentId
    }

    finalize(finalizedTick: number): void {
        if (this._finalized) {
            throw new Error(`Transaction ${this.id} already finalized at tick ${this._finalizedAtTick}`)
        }
        this._finalized = true
        this._finalizedAtTick = finalizedTick
        this._intentsFrozen = Object.freeze([...this._intents])
        this._metadata = new Map(this._metadata)
    }

    assertNotFinalized(operation: string): void {
        if (this._finalized) {
            throw new Error(`Cannot ${operation} on finalized transaction ${this.id}`)
        }
    }

    setMetadata(key: string, value: unknown): void {
        this.assertNotFinalized('setMetadata')
        this._metadata.set(key, value)
    }

    appendIntent(intent: TransportIntent): ExecutionTransaction {
        this.assertNotFinalized('appendIntent')
        const newTransaction = new ExecutionTransaction(
            this.id,
            this.startTime,
            this._parentId
        )
        newTransaction._intents = [...this._intents, Object.freeze({ ...intent })]
        newTransaction._sequence = intent.sequence
        newTransaction._metadata = new Map(this._metadata)
        newTransaction._revision = this._revision + 1
        return newTransaction
    }

    getIntents(): readonly TransportIntent[] {
        return this._intents
    }

    evolve(newIntents: TransportIntent[]): ExecutionTransaction {
        this.assertNotFinalized('evolve')
        const newTransaction = new ExecutionTransaction(
            this.id,
            this.startTime,
            this._parentId
        )
        newTransaction._intents = [...this._intents, ...newIntents]
        newTransaction._sequence = newIntents.length > 0 ? newIntents[newIntents.length - 1].sequence : this._sequence
        newTransaction._metadata = new Map(this._metadata)
        newTransaction._revision = this._revision + 1
        return newTransaction
    }
}

let transactionIdCounter = 0

export function createTransaction(id?: string, parentId?: string, startTick?: number): ExecutionTransaction {
    const seq = ++transactionIdCounter
    const transactionId = id || `txn-${seq.toString().padStart(6, '0')}`
    return new ExecutionTransaction(
        transactionId,
        startTick ?? 0,
        parentId
    )
}

export function createTransactionWithLineage(parent: ExecutionTransaction): ExecutionTransaction {
    const child = createTransaction(parent.id)
    child.setMetadata('parentRevision', parent.revision)
    child.setMetadata('lineage', `${parent.id}:${parent.revision}`)
    return child
}

export function createTransportFacade(
    capabilities?: Partial<TransportCapabilities>,
    transaction?: ExecutionTransaction,
    getNextSequence?: () => number,
    clock?: DeterministicClock
): TransportFacade {
    const merged: TransportCapabilities = Object.freeze({
        allowQuoted: capabilities?.allowQuoted ?? true,
        allowMedia: capabilities?.allowMedia ?? true,
        allowEdits: capabilities?.allowEdits ?? false,
        allowReactions: capabilities?.allowReactions ?? true,
        maxMediaSize: capabilities?.maxMediaSize ?? 16 * 1024 * 1024
    })
    const facade = new RuntimeTransportFacade(merged, getNextSequence, clock)

    if (transaction) {
        let currentTransaction = transaction
        facade.bindTransaction(
            () => currentTransaction,
            (t) => { currentTransaction = t }
        )
    }

    return facade
}

export function createCommitCoordinator(
    client: any,
    capabilities?: Partial<TransportCapabilities>
): TransportCommitCoordinator {
    const merged: TransportCapabilities = Object.freeze({
        allowQuoted: capabilities?.allowQuoted ?? true,
        allowMedia: capabilities?.allowMedia ?? true,
        allowEdits: capabilities?.allowEdits ?? false,
        allowReactions: capabilities?.allowReactions ?? true,
        maxMediaSize: capabilities?.maxMediaSize ?? 16 * 1024 * 1024
    })
    return new TransportCommitCoordinator(client, merged)
}