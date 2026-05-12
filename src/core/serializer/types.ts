import type { GroupMetadata } from 'baileys'
import type { proto } from 'baileys'

export type MessageType =
    | 'text'
    | 'image'
    | 'video'
    | 'audio'
    | 'document'
    | 'sticker'
    | 'reaction'
    | 'unknown'

export type ChatType = 'group' | 'dm' | 'channel'

// CORRECTED: GroupRef - lazy hydration, NOT full snapshot
export interface GroupRef {
    readonly jid: string
    resolve(): Promise<GroupMetadataSnapshot | null>
    getAdmins(): Promise<string[]>
}

export interface GroupMetadataSnapshot {
    readonly jid: string
    readonly subject: string
    readonly description: string | null
    readonly owner: string | null
    readonly participants: ParticipantSnapshot[]
    readonly admins: string[]
}

export interface ParticipantSnapshot {
    readonly jid: string
    readonly isAdmin: boolean
    readonly isSuperadmin: boolean
}

// CORRECTED: TransportRef - no raw payload exposure
export interface TransportRef {
    readonly messageId: string
    readonly chatJid: string
    readonly senderJid: string
}

// CORRECTED: MediaCapability - capability-based, NOT buffer ownership
export interface MediaCapability {
    readonly type: 'image' | 'video' | 'audio' | 'document' | 'sticker'
    readonly mime: string
    readonly size: number
    readonly filename: string | null
    readonly dimensions: { width: number; height: number } | null
    readonly duration: number | null
    readonly caption: string | null

    // Capability-based access, NOT buffer ownership
    download(): Promise<Buffer>
    getThumbnail(): Promise<Buffer | null>
}

// Backward compatible alias (deprecated)
export interface MediaAttachment extends MediaCapability {}

export interface QuotedMessage {
    readonly id: string
    readonly senderJid: string
    readonly content: string | null
    readonly type: MessageType
    readonly isFromMe: boolean

    buildContextInfo(): proto.IContextInfo
}

export interface LazyProperty<T> {
    get(): T
    isLoaded(): boolean
    load(): Promise<T>
}

class LazyLoaded<T> implements LazyProperty<T> {
    private _value: T | undefined
    private _loaded = false
    private _loading: Promise<T> | null = null

    constructor(private readonly factory: () => Promise<T>) {}

    get(): T {
        if (!this._loaded) {
            throw new Error('LazyProperty not loaded - call load() first')
        }
        return this._value as T
    }

    isLoaded(): boolean {
        return this._loaded
    }

    async load(): Promise<T> {
        if (this._loaded) return this._value as T
        if (this._loading) return this._loading

        this._loading = this.factory().then((v) => {
            this._value = v
            this._loaded = true
            this._loading = null
            return v
        })

        return this._loading
    }
}

export function createLazyProperty<T>(factory: () => Promise<T>): LazyProperty<T> {
    return new LazyLoaded(factory)
}

export interface NormalizedMessage {
    readonly id: string
    readonly chatJid: string
    readonly senderJid: string
    readonly isFromMe: boolean
    readonly chatType: ChatType
    readonly type: MessageType
    readonly content: string | null
    readonly caption: string | null
    readonly quoted: QuotedMessage | null
    readonly mentioned: readonly string[]
    readonly urls: readonly string[]
    readonly args: readonly string[]
    readonly command: string | null
    readonly commandPrefix: string | null
    readonly timestamp: number
    readonly pushName: string | null
    readonly sender: SenderInfo
    // CORRECTED: GroupRef instead of full snapshot
    readonly groupRef: LazyProperty<GroupRef | null>
    readonly transportRef: TransportRef
    // CORRECTED: MediaCapability instead of buffer ownership
    readonly media: LazyProperty<MediaCapability | null>
}

export interface SenderInfo {
    readonly jid: string
    readonly username: string
    readonly isAdmin: boolean
}

export interface ValidationError {
    field: string
    code: 'MISSING_REQUIRED' | 'INVALID_TYPE' | 'MALFORMED_CONTENT' | 'TRANSPORT_VIOLATION'
    message: string
}

export interface ValidationWarning {
    field: string
    code: 'DEPRECATED_FORMAT' | 'POSSIBLE_MALFORMED' | 'AMBIGUOUS_TYPE'
    message: string
}

export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
    warnings: ValidationWarning[]
}

export interface GroupEventPayload {
    readonly jid: string
    readonly action: 'add' | 'remove' | 'promote' | 'demote'
    readonly participants: string[]
    readonly actor: string | null
    // CORRECTED: Use GroupRef instead of full snapshot
    readonly groupRef: LazyProperty<GroupRef | null>
}

export interface CallEventPayload {
    readonly callId: string
    readonly from: string
    readonly isVideo: boolean
}

export interface PresenceEventPayload {
    readonly jid: string
    readonly status: 'online' | 'offline' | 'typing' | 'recording'
    readonly lastSeen?: number
}