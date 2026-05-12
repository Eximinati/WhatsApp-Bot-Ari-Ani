import {
    extractMessageContent,
    getContentType,
    normalizeMessageContent,
    isJidGroup,
    jidNormalizedUser,
    areJidsSameUser,
    type WAMessage,
    type GroupMetadata
} from 'baileys'
import type { proto } from 'baileys'
import type {
    ISerializer,
    ISerializerDependencies
} from './contracts.js'
import type {
    NormalizedMessage,
    MessageType,
    ChatType,
    SenderInfo,
    GroupRef,
    GroupMetadataSnapshot,
    ParticipantSnapshot,
    TransportRef,
    MediaCapability,
    QuotedMessage,
    LazyProperty,
    createLazyProperty,
    ValidationResult,
    ValidationError
} from './types.js'

interface InternalDeps {
    getGroupMetadata: (jid: string) => Promise<GroupMetadata | null>
    downloadMedia: (message: WAMessage) => Promise<Buffer | null>
    getContact: (jid: string) => { notify?: string; name?: string; vname?: string }
    prefix: string
    isMe: (jid: string) => boolean
    userJid: string
}

export class MessageSerializer implements ISerializer {
    private deps: InternalDeps

    constructor(dependencies: ISerializerDependencies) {
        this.deps = {
            getGroupMetadata: dependencies.getGroupMetadata.bind(dependencies),
            downloadMedia: dependencies.downloadMedia.bind(dependencies),
            getContact: dependencies.getContact.bind(dependencies),
            prefix: dependencies.getConfig().prefix,
            isMe: dependencies.isMe.bind(dependencies),
            userJid: ''
        }
    }

    setUserJid(jid: string): void {
        this.deps.userJid = jid
    }

    validate(raw: WAMessage): ValidationResult {
        const errors: ValidationError[] = []

        if (!raw.key?.id) {
            errors.push({
                field: 'key.id',
                code: 'MISSING_REQUIRED',
                message: 'Message ID is required'
            })
        }

        if (!raw.key?.remoteJid) {
            errors.push({
                field: 'key.remoteJid',
                code: 'MISSING_REQUIRED',
                message: 'Chat JID is required'
            })
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings: []
        }
    }

    async normalize(raw: WAMessage): Promise<NormalizedMessage> {
        const innerMessage: any = extractMessageContent(raw.message) || raw.message || {}
        const type = this.normalizeMessageType(innerMessage)

        const remoteJid = raw.key.remoteJid || ''
        const fromGroup = isJidGroup(remoteJid) === true
        const chatType: ChatType = fromGroup ? 'group' : 'dm'
        const isFromMe = raw.key.fromMe === true

        const senderRaw = fromGroup
            ? raw.key.participant || (isFromMe ? this.deps.userJid : '')
            : isFromMe
              ? this.deps.userJid
              : remoteJid
        const sender = senderRaw ? jidNormalizedUser(senderRaw) : ''

        const contact = this.deps.getContact(sender)
        const senderInfo = this.buildSenderInfo(sender, contact, raw.pushName ?? undefined, raw.verifiedBizName ?? undefined, isFromMe)

        const extracted = this.extractContent(innerMessage, type)
        const contentText = extracted.text ?? extracted.caption
        const quoted = this.buildQuotedMessage(innerMessage, type, remoteJid)
        const mentioned = this.extractMentioned(innerMessage, type)
        const { args, command, commandPrefix } = this.parseCommand(
            contentText,
            this.deps.prefix
        )
        const urls = this.extractUrls(contentText)

        const transportRef = this.createTransportRef(raw, remoteJid, sender)

        const message: NormalizedMessage = {
            id: raw.key.id || '',
            chatJid: remoteJid,
            senderJid: sender,
            isFromMe,
            chatType,
            type,
            content: extracted.text,
            caption: extracted.caption,
            quoted,
            mentioned,
            urls,
            args,
            command,
            commandPrefix,
            timestamp: Number(raw.messageTimestamp || 0) * 1000,
            pushName: raw.pushName || null,
            sender: senderInfo,
            groupRef: this.createLazyGroupRef(remoteJid, fromGroup),
            transportRef: transportRef,
            media: this.createLazyMediaCapability(raw, type)
        }

        return message
    }

    private normalizeMessageType(innerMessage: any): MessageType {
        const baileysType = getContentType(innerMessage) || ''

        switch (baileysType) {
            case 'conversation':
            case 'extendedTextMessage':
                return 'text'
            case 'imageMessage':
                return 'image'
            case 'videoMessage':
                return 'video'
            case 'audioMessage':
                return 'audio'
            case 'documentMessage':
                return 'document'
            case 'stickerMessage':
                return 'sticker'
            case 'reactionMessage':
                return 'reaction'
            default:
                return 'unknown'
        }
    }

    private buildSenderInfo(
        sender: string,
        contact: { notify?: string; name?: string; vname?: string },
        pushName: string | undefined,
        verifiedBizName: string | undefined,
        isFromMe: boolean
    ): SenderInfo {
        return {
            jid: sender,
            username:
                contact.notify ||
                contact.vname ||
                contact.name ||
                pushName ||
                verifiedBizName ||
                sender.split('@')[0] ||
                'User',
            isAdmin: false
        }
    }

    private extractContent(
        innerMessage: any,
        type: MessageType
    ): { text: string | null; caption: string | null } {
        const msgVal = innerMessage as Record<string, { text?: string; caption?: string } | string | undefined>

        let text: string | null = null
        let caption: string | null = null

        if (type === 'text') {
            if (msgVal.conversation) {
                text = msgVal.conversation as string
            } else if (msgVal.extendedTextMessage) {
                text = (msgVal.extendedTextMessage as { text?: string })?.text || null
            }
        } else if (type === 'image' || type === 'video' || type === 'document') {
            caption = (msgVal[type + 'Message'] as { caption?: string })?.caption || ''
        }

        return { text, caption }
    }

    private extractTextContent(innerMessage: any, type: MessageType): string | null {
        const extracted = this.extractContent(innerMessage, type)
        return extracted.text ?? extracted.caption
    }

    private buildQuotedMessage(
        innerMessage: Record<string, unknown>,
        type: MessageType,
        remoteJid: string
    ): QuotedMessage | null {
        const msgVal = innerMessage as Record<string, { contextInfo?: proto.IContextInfo } | undefined>
        const ctxInfo = msgVal[type + 'Message']?.contextInfo as proto.IContextInfo | undefined

        if (!ctxInfo?.quotedMessage) {
            return null
        }

        const quotedMessage = ctxInfo.quotedMessage
        const quotedSender = ctxInfo.participant ? jidNormalizedUser(ctxInfo.participant) : null
        const isFromMe = quotedSender ? this.deps.isMe(quotedSender) : false

        const quotedType = this.normalizeMessageType(quotedMessage as Record<string, unknown>)
        const quotedContent = this.extractTextContent(quotedMessage as Record<string, unknown>, quotedType)

        return {
            id: ctxInfo.stanzaId || '',
            senderJid: quotedSender || '',
            content: quotedContent,
            type: quotedType,
            isFromMe,
            buildContextInfo: () => {
                return {
                    stanzaId: ctxInfo.stanzaId,
                    participant: ctxInfo.participant,
                    quotedMessage: quotedMessage
                }
            }
        }
    }

    private extractMentioned(
        innerMessage: any,
        type: MessageType
    ): readonly string[] {
        const msgVal = innerMessage as Record<string, { contextInfo?: proto.IContextInfo } | undefined>
        const ctxInfo = msgVal[type + 'Message']?.contextInfo as proto.IContextInfo | undefined

        if (!ctxInfo?.mentionedJid) {
            return []
        }

        return ctxInfo.mentionedJid.filter((v): v is string => !!v)
    }

    private parseCommand(content: string | null, prefix: string): {
        args: readonly string[]
        command: string | null
        commandPrefix: string | null
    } {
        if (!content) {
            return { args: [], command: null, commandPrefix: null }
        }

        const trimmed = content.trim()
        const parts = trimmed.split(/\s+/).filter(Boolean)

        if (parts.length === 0) {
            return { args: [], command: null, commandPrefix: null }
        }

        const firstWord = parts[0]
        if (!firstWord.startsWith(prefix)) {
            return { args: parts.slice(1), command: null, commandPrefix: null }
        }

        const command = firstWord.slice(prefix.length).toLowerCase()
        return {
            args: parts.slice(1),
            command,
            commandPrefix: prefix
        }
    }

    private extractUrls(content: string | null): readonly string[] {
        if (!content) {
            return []
        }

        const urlRegex = /https?:\/\/[^\s]+/gi
        const matches = content.match(urlRegex)
        return matches ? matches : []
    }

    private createTransportRef(raw: WAMessage, chatJid: string, senderJid: string): TransportRef {
        return {
            messageId: raw.key.id || '',
            chatJid,
            senderJid
        }
    }

    private createLazyGroupRef(jid: string, isGroup: boolean): LazyProperty<GroupRef | null> {
        return this.createLazy(async () => {
            if (!isGroup) {
                return null
            }

            const metadata = await this.deps.getGroupMetadata(jid)
            if (!metadata) {
                return null
            }

            return this.buildGroupRef(metadata)
        })
    }

    private buildGroupRef(metadata: GroupMetadata): GroupRef {
        const admins = metadata.participants
            .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
            .map(p => p.id)

        const snapshot: GroupMetadataSnapshot = {
            jid: metadata.id,
            subject: metadata.subject,
            description: metadata.desc || null,
            owner: metadata.owner || null,
            participants: metadata.participants.map(p => ({
                jid: p.id,
                isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
                isSuperadmin: p.admin === 'superadmin'
            })),
            admins
        }

        return {
            jid: metadata.id,
            resolve: async () => snapshot,
            getAdmins: async () => admins
        }
    }

    private createLazyMediaCapability(raw: WAMessage, type: MessageType): LazyProperty<MediaCapability | null> {
        return this.createLazy(async () => {
            if (type !== 'image' && type !== 'video' && type !== 'audio' && type !== 'document' && type !== 'sticker') {
                return null
            }

            const buffer = await this.deps.downloadMedia(raw)
            if (!buffer) {
                return null
            }

            const msgVal = (raw.message || {}) as Record<string, unknown>
            const msgType = type + 'Message'
            const msg = msgVal[msgType] as Record<string, unknown> | undefined

            let mime = 'application/octet-stream'
            let filename: string | null = null
            let width: number | null = null
            let height: number | null = null
            let duration: number | null = null
            let caption: string | null = null
            let size = 0

            if (msg) {
                mime = (msg.mimetype as string) || mime
                filename = (msg.fileName as string) || null
                width = (msg.width as number) || null
                height = (msg.height as number) || null
                duration = (msg.seconds as number) || null
                caption = (msg.caption as string) || null
            }

            size = buffer.length

            const dimensions = (width !== null && height !== null) 
                ? { width, height } 
                : null

            return {
                type: type as MediaCapability['type'],
                mime,
                size,
                filename,
                dimensions,
                duration,
                caption,
                download: async () => buffer,
                getThumbnail: async () => null
            }
        })
    }

    private createLazy<T>(factory: () => Promise<T>): LazyProperty<T> {
        let _value: T | undefined
        let _loaded = false
        let _loading: Promise<T> | null = null

        const lazy: LazyProperty<T> = {
            get(): T {
                if (!_loaded) {
                    throw new Error('LazyProperty not loaded - call load() first')
                }
                return _value as T
            },
            isLoaded(): boolean {
                return _loaded
            },
            async load(): Promise<T> {
                if (_loaded) return _value as T
                if (_loading) return _loading

                _loading = factory().then(v => {
                    _value = v
                    _loaded = true
                    _loading = null
                    return v
                })

                return _loading
            }
        }

        return lazy
    }
}