import type { NormalizedMessage } from '../serializer/types.js'
import type { MiddlewareMetadata } from '../middleware/types.js'
import type { StateSnapshot } from '../state/index.js'

export enum TransportIntentType {
    SEND_TEXT = 'SEND_TEXT',
    SEND_MEDIA = 'SEND_MEDIA',
    REACT = 'REACT',
    EDIT = 'EDIT',
    DELETE = 'DELETE',
    QUOTE = 'QUOTE',
    TYPING = 'TYPING',
    PRESENCE = 'PRESENCE'
}

export interface TransportIntent {
    readonly id: string
    readonly sequence: number
    readonly type: TransportIntentType
    readonly targetJid: string
    readonly payload?: {
        readonly text?: string
        readonly media?: MediaPayload
        readonly reaction?: string
        readonly editId?: string
        readonly deleteId?: string
        readonly quotedId?: string
        readonly typing?: boolean
        readonly presence?: 'composing' | 'paused' | 'available'
    }
    readonly options?: TransportOptions
    readonly createdAtTick: number
}

export interface TransportOptions {
    readonly quoted?: string
    readonly mentioned?: readonly string[]
    readonly contextInfo?: Record<string, unknown>
    readonly thumbnail?: Buffer
    readonly gifPlayback?: boolean
}

export interface MediaPayload {
    readonly type: 'image' | 'video' | 'audio' | 'document' | 'sticker'
    readonly buffer?: Buffer
    readonly url?: string
    readonly caption?: string
    readonly mimetype?: string
}

export interface TransportCapabilities {
    readonly allowQuoted: boolean
    readonly allowMedia: boolean
    readonly allowEdits: boolean
    readonly allowReactions: boolean
    readonly maxMediaSize: number
}

export interface TransportResult {
    success: boolean
    messageId?: string
    error?: Error
}

export interface CommitResult {
    readonly success: boolean
    readonly intentId: string
    readonly messageId?: string
    readonly error?: Error
    readonly committedAt: number
}

export interface TransactionCommitResult {
    readonly transactionId: string
    readonly results: readonly CommitResult[]
    readonly success: boolean
    readonly totalDurationMs: number
}

export enum CommitDecision {
    ALLOW = 'ALLOW',
    DENY = 'DENY',
    REWRITE = 'REWRITE',
    PARTIAL = 'PARTIAL'
}

export interface PreCommitResult {
    readonly decision: CommitDecision
    readonly intents: readonly TransportIntent[]
    readonly denialReason?: string
    readonly metadata?: Record<string, unknown>
}

export interface ExecutionContext {
    readonly message: NormalizedMessage
    readonly executionId: string
    readonly startTime: number
    readonly transport: TransportFacade
    readonly capabilities: TransportCapabilities
    readonly metadata: MiddlewareMetadata
    readonly transaction: ExecutionTransaction
}

export interface ExecutionTransaction {
    readonly id: string
    readonly startTime: number
    readonly transportIntents: readonly TransportIntent[]
    readonly sequence: number
    readonly stateSnapshot?: StateSnapshot

    appendIntent(intent: TransportIntent): ExecutionTransaction
    getIntents(): readonly TransportIntent[]
}

export interface TransportFacade {
    queueText(jid: string, text: string, options?: TransportOptions): TransportIntent
    queueMedia(jid: string, media: MediaPayload, options?: TransportOptions): TransportIntent
    queueReaction(jid: string, messageId: string, emoji: string): TransportIntent
    queueEdit(jid: string, messageId: string, newText: string): TransportIntent
    queueDelete(jid: string, messageId: string): TransportIntent
    queueQuote(jid: string, text: string, quotedMessageId: string): TransportIntent
    queueTyping(jid: string, typing: boolean): TransportIntent
    queuePresence(jid: string, presence: 'composing' | 'paused' | 'available'): TransportIntent

    downloadMedia(messageId: string): Promise<Buffer | null>

    getQueuedIntents(): readonly TransportIntent[]
    clearIntents(): void
}

export const DEFAULT_TRANSPORT_CAPABILITIES: TransportCapabilities = Object.freeze({
    allowQuoted: true,
    allowMedia: true,
    allowEdits: false,
    allowReactions: true,
    maxMediaSize: 16 * 1024 * 1024
})