import { EventEmitter } from 'events'
import { join } from 'path'
import crypto from 'crypto'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode'
import axios from 'axios'
import pino from 'pino'
import NodeCache from 'node-cache'
import { fireAndForget } from '../utils/async.js'
import {
    makeWASocket,
    fetchLatestBaileysVersion,
    Browsers,
    DisconnectReason,
    downloadMediaMessage as baileysDownloadMediaMessage,
    extractMessageContent,
    getContentType,
    normalizeMessageContent,
    isJidGroup,
    isJidBroadcast,
    isJidNewsletter,
    jidNormalizedUser,
    areJidsSameUser,
    proto,
    type WASocket,
    type WAMessage,
    type WAMessageContent,
    type WAMessageKey,
    type AnyMessageContent,
    type GroupMetadata,
    type ConnectionState,
    type WAVersion
} from 'baileys'
import { MongoAuthStore } from './MongoAuth.js'

import DatabaseHandler from '../pipeline/DataStore.js'
import ChatAI from './ChatAI.js'
import Identity from './Identity.js'
import Toolkit from './Toolkit.js'
import MediaMenu from './MediaMenu.js'
import MenuManager from './MenuManager.js'
import { ExponentialBackoff } from '../runtime/ExponentialBackoff.js'
import { TimerRegistry } from '../runtime/TimerRegistry.js'
import type MessagePipeline from '../pipeline/MessagePipeline.js'
import {
    ICommandContext,
    IConfig,
    IContactInfo,
    IExtendedGroupMetadata,
    IFeatureModel,
    IGroupModel,
    ISimplifiedMessage,
    IUserModel
} from '../typings/index.js'
import { MessageType, Mimetype } from './types.js'
import QuotaService from '../services/QuotaService.js'
import XpService from '../services/XpService.js'
import ViewOnceService from '../services/ViewOnceService.js'
import GroupService from '../services/GroupService.js'
import UserDataService from '../services/UserDataService.js'

type ConnectionStatus = 'open' | 'connecting' | 'close'

// =========================================================================
// BUILDMESSAGECONTENT — translate legacy MessageType/Mimetype to Baileys v7
// =========================================================================

// Translate the legacy MessageType / Mimetype calling style into a v7
// AnyMessageContent payload.
const buildMessageContent = (
    content: string | Buffer,
    type: string = MessageType.text,
    mime?: string,
    mention?: string[],
    caption?: string,
    thumbnail?: Buffer
): AnyMessageContent => {
    const mentions = mention && mention.length ? mention : undefined
    if (typeof content === 'string') {
        return { text: content, mentions } as AnyMessageContent
    }
    switch (type) {
        case MessageType.image:
            return {
                image: content,
                caption,
                // Omit mimetype if not provided; Baileys sniffs the buffer header.
                ...(mime ? { mimetype: mime } : {}),
                mentions,
                jpegThumbnail: thumbnail
            } as AnyMessageContent
        case MessageType.video: {
            // GIF playback in WhatsApp is an MP4 with `gifPlayback: true`.
            // Callers signal "this should play like a GIF" by passing
            // `Mimetype.gif`. The actual buffer is MP4 (callers convert via
            // ffmpeg first), so the mimetype on the message MUST be video/mp4
            // — sending image/gif on a video message confuses clients and
            // they refuse to render it. We override here so callers don't
            // have to remember.
            const isGif = mime === Mimetype.gif
            return {
                video: content,
                caption,
                mimetype: isGif ? 'video/mp4' : mime,
                mentions,
                gifPlayback: isGif,
                jpegThumbnail: thumbnail
            } as AnyMessageContent
        }
        case MessageType.sticker:
            return { sticker: content, mimetype: Mimetype.webp } as AnyMessageContent
        case MessageType.audio:
            // Don't force a default mimetype: callers send a mix of MP3
            // (yt-dlp/spotifydl), m4a, and opus. Forcing `audio/ogg; codecs=opus`
            // on an MP3 made WhatsApp refuse to play it. Let Baileys sniff
            // from the buffer; only set mimetype when the caller specifies one.
            return {
                audio: content,
                ...(mime ? { mimetype: mime } : {}),
                ptt: false
            } as AnyMessageContent
        case MessageType.document:
            return {
                document: content,
                ...(mime ? { mimetype: mime } : {}),
                fileName: caption || 'file'
            } as AnyMessageContent
        case MessageType.text:
        case MessageType.extendedText:
            return { text: content.toString('utf8'), mentions } as AnyMessageContent
        default:
            return { text: content.toString('utf8'), mentions } as AnyMessageContent
    }
}

export default class RuntimeClient extends EventEmitter implements ICommandContext {

    // =========================================================================
    // STATE
    // =========================================================================

    private sock!: WASocket
    DB = new DatabaseHandler()
    util = new Toolkit()
    identity: Identity = new Identity(this)
    chatAI: ChatAI = new ChatAI(this)
    mediaMenu = new MediaMenu(this)
    menus = new MenuManager(this)
    pipeline!: MessagePipeline
    private assets = new Map<string, Buffer>()
    private features = new Map<string, boolean>()
    private contacts = new Map<string, IContactInfo>()
    private chats = new Set<string>()

    // --- Caches (NodeCache) ---
    private static nc = (ttl: number, maxKeys?: number): NodeCache =>
        new NodeCache({ stdTTL: ttl, useClones: false, ...(maxKeys ? { maxKeys } : {}) })

    private messageCache = RuntimeClient.nc(3600, 1000)
    private groupMetadataCache = RuntimeClient.nc(300)
    private msgRetryCounterCache = RuntimeClient.nc(60)
    private userDevicesCache = RuntimeClient.nc(300)
    private sentByBot = RuntimeClient.nc(120, 5000)

    /** Per-JID burst counter — last-resort circuit breaker if the primary
     * defenses fail (e.g., bot crash between send and echo, or a bot reply
     * accidentally starts with the command prefix). If the same chat triggers
     * more than this many commands within the rolling window, drop further
     * fromMe messages until the window expires. */
    private static readonly LOOP_BURST_LIMIT = 8
    private static readonly LOOP_BURST_WINDOW_MS = 10_000
    private commandBurst = new Map<string, number[]>()

    state: ConnectionStatus = 'connecting'
    QR?: Buffer
    private logger = pino({
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'warn')
    })

    // --- Reconnect State ---
    /** Guards against multiple concurrent reconnect attempts when WA fires
     * `connection.update {connection: 'close'}` twice in quick succession. */
    private isReconnecting = false
    private reconnectBackoff = new ExponentialBackoff()
    private timerRegistry = TimerRegistry.getInstance()
    private reconnectTimerRef: NodeJS.Timeout | null = null
    private user_: { id: string; jid: string; name?: string; lid?: string } | null = null
    /** Set of every JID (in PN AND LID forms) that's considered a moderator,
     * resolved at connect time so that LID-only groups still match the
     * PN-form mods listed in the config env var. */
    private modJids = new Set<string>()

    constructor(public config: IConfig) {
        super()
    }

    removeAllListeners(): this {
        super.removeAllListeners()
        return this
    }

    // =========================================================================
    // IDENTITY & AUTH
    // =========================================================================

    log = (text: string, error?: boolean): void => {
        const timestamp = new Date().toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
        const prefix = error ? '[ERROR]' : '[RUNTIME]'
        console.log(`${timestamp} ${prefix} ${text}`)
    }

    get user(): {
        jid: string
        id: string
        lid?: string
        name?: string
        notify?: string
        vname?: string
        short?: string
    } {
        const id = this.user_?.jid || this.user_?.id || ''
        return {
            id,
            jid: id,
            lid: this.user_?.lid,
            name: this.user_?.name,
            notify: this.user_?.name,
            vname: this.user_?.name,
            short: this.user_?.name?.split(' ')[0]
        }
    }

    /** Match a JID against the bot's own user, regardless of LID/PN form. */
    isMe = (jid: string | null | undefined): boolean => {
        if (!jid) return false
        const n = jidNormalizedUser(jid)
        if (this.user_?.jid && areJidsSameUser(n, this.user_.jid)) return true
        if (this.user_?.lid && areJidsSameUser(n, this.user_.lid)) return true
        return false
    }

    /** True if a JID is configured as a mod (matches in either LID or PN form). */
    isMod = (jid: string | null | undefined): boolean => {
        if (!jid) return false
        const n = jidNormalizedUser(jid)
        if (this.modJids.has(n)) return true
        // Also match by user portion in case device suffix differs.
        for (const m of this.modJids) if (areJidsSameUser(m, n)) return true
        return this.isMe(jid)
    }

    /** Convenience: is the bot an admin of this group? */
    isBotAdmin = (meta?: IExtendedGroupMetadata | null): boolean =>
        !!meta?.admins?.some((j) => this.isMe(j))

    /** Resolve every configured mod's LID counterpart so isMod() matches in
     * LID-addressed groups too. Best-effort — failures are silent. */
    private resolveMods = async (): Promise<void> => {
        this.modJids.clear()
        for (const m of this.config.mods || []) {
            if (!m) continue
            const norm = jidNormalizedUser(m)
            this.modJids.add(norm)
            try {
                const lid = await this.sock.signalRepository?.lidMapping?.getLIDForPN?.(norm)
                if (lid) this.modJids.add(jidNormalizedUser(lid))
            } catch {
                /* ignore */
            }
        }
    }

    disposeSocket(): void {
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners('creds.update')
                this.sock.ev.removeAllListeners('connection.update')
                this.sock.ev.removeAllListeners('messages.upsert')
                this.sock.ev.removeAllListeners('contacts.upsert')
                this.sock.ev.removeAllListeners('contacts.update')
                this.sock.ev.removeAllListeners('chats.upsert')
                this.sock.ev.removeAllListeners('groups.update')
                this.sock.ev.removeAllListeners('group-participants.update')
                this.sock.ev.removeAllListeners('call')
            } catch {
                /* ignore if already removed */
            }
        }
    }

    private authSession: Awaited<ReturnType<MongoAuthStore['getAuthState']>> | null = null

    // =========================================================================
    // CONNECTION LIFECYCLE
    // =========================================================================

    connect = async (): Promise<void> => {
        if (this.sock) {
            this.disposeSocket()
        }

        const getEncryptionKey = (): string => {
            const existing = process.env.APP_ENCRYPTION_KEY
            if (existing) return existing
            const generated = crypto.randomBytes(32).toString('hex')
            console.log(`[MongoAuth] APP_ENCRYPTION_KEY auto-generated: ${generated}`)
            console.log(`[MongoAuth] Set APP_ENCRYPTION_KEY env var to persist this key across restarts.`)
            return generated
        }
        const encryptionKey = getEncryptionKey()
        const authStore = new MongoAuthStore({
            sessionId: this.config.session,
            logger: this.logger,
            encryptionKey
        })
        this.authSession = await authStore.getAuthState()
        const { state: authState, saveCreds } = this.authSession

        const { version, isLatest } = await fetchLatestBaileysVersion()
        this.log(`Using Baileys WA v${version.join('.')} (latest: ${isLatest})`)

        this.sock = makeWASocket({
            version: version as WAVersion,
            auth: authState as never,
            logger: this.logger,
            browser: Browsers.appropriate('Ari-Ani'),
            getMessage: this.getMessage,
            cachedGroupMetadata: this.cachedGroupMetadata,
            msgRetryCounterCache: this.msgRetryCounterCache as unknown as never,
            userDevicesCache: this.userDevicesCache as unknown as never,
            shouldIgnoreJid: this.shouldIgnoreJid,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            defaultQueryTimeoutMs: 60_000,
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 5
        })

        this.groups = new GroupService(this.sock, this.groupMetadataCache)

        this.sock.ev.on('creds.update', saveCreds)
        this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update))
        this.sock.ev.on('messages.upsert', (event) => this.handleMessagesUpsert(event))
        this.sock.ev.on('contacts.upsert', (contacts) => this.handleContactsUpsert(contacts))
        this.sock.ev.on('contacts.update', (contacts) => this.handleContactsUpdate(contacts))
        this.sock.ev.on('chats.upsert', (chats) => { for (const c of chats) if (c.id) this.chats.add(c.id) })
        this.sock.ev.on('groups.update', (updates) => this.handleGroupsUpdate(updates))
        this.sock.ev.on('group-participants.update', (event) => this.handleGroupParticipantsUpdate(event))
        this.sock.ev.on('call', (calls) => this.handleCall(calls))
    }

    // =========================================================================
    // EVENT HANDLERS
    // =========================================================================

    private handleConnectionUpdate = async (update: Partial<ConnectionState>): Promise<void> => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            this.QR = await qrcode.toBuffer(qr)
            this.log(
                `QR Code ready | Authenticate at http://localhost:${process.env.PORT || 4040}/wa/qr?session=${this.config.session}`
            )
            try {
                this.log(await qrcode.toString(qr, { type: 'terminal', small: true }))
            } catch {
                /* ignore */
            }
        }
        if (connection) this.state = connection
        if (connection === 'open') {
            const id = this.sock.user?.id ? jidNormalizedUser(this.sock.user.id) : ''
            const lidRaw = (this.sock.user as { lid?: string })?.lid
            this.user_ = {
                id,
                jid: id,
                name: this.sock.user?.name,
                lid: lidRaw ? jidNormalizedUser(lidRaw) : undefined
            }
            this.QR = undefined
            // Pre-resolve mod LIDs so isMod() works on first group message.
            fireAndForget(this.resolveMods())
            // Kick off background view-once cache pruner.
            fireAndForget(this.pruneViewOnce())
            if (!this.viewOncePruneTimer) {
                this.viewOncePruneTimer = this.timerRegistry.registerInterval(
                    'RuntimeClient',
                    () => { fireAndForget(this.pruneViewOnce()) },
                    6 * 60 * 60 * 1000,
                    'viewOncePrune'
                )
            }
            this.emit('open')
        } else if (connection === 'close') {
            const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
            const shouldReconnect = code !== DisconnectReason.loggedOut

            const shouldClearSession = code === DisconnectReason.loggedOut || code === DisconnectReason.badSession
            if (shouldClearSession) {
                this.log('Session became invalid, clearing auth state...', true)
                if (this.authSession) {
                    await this.authSession.clear()
                }
            }

            this.log(
                `Connection closed${code ? ` (code ${code})` : ''}. ${
                    shouldReconnect ? 'Reconnecting...' : 'Logged out — auth cleared, will re-pair on restart.'
                }`,
                !shouldReconnect
            )
            if (shouldReconnect && !this.isReconnecting) {
                if (!this.reconnectBackoff.shouldReconnect()) {
                    this.log(`Max reconnect attempts reached, stopping reconnection`, true)
                    return
                }
                
                this.isReconnecting = true
                this.reconnectBackoff.startAttempt(`code_${code || 'unknown'}`)
                const delay = this.reconnectBackoff.getBackoffDelay()
                const backoffState = this.reconnectBackoff.getState()
                
                this.log(`Reconnect attempt ${backoffState.attempt} in ${delay}ms`)
                
                this.reconnectTimerRef = this.timerRegistry.registerTimeout(
                    'RuntimeClient',
                    () => {
                        this.connect()
                            .then(() => {
                                this.reconnectBackoff.onSuccessfulConnect()
                                this.log(`Reconnected successfully, backoff reset`)
                            })
                            .catch((e) => {
                                this.log(`Reconnect failed: ${e}`, true)
                            })
                            .finally(() => {
                                this.isReconnecting = false
                            })
                    },
                    delay,
                    'reconnect'
                )
            }
        }
    }

    private handleMessagesUpsert = ({ messages, type }: { messages: WAMessage[]; type: string }): void => {
        if (type !== 'notify' && type !== 'append') return
        for (const m of messages) {
            if (!m.message || !m.key) continue

            if (m.key.id && this.sentByBot.has(m.key.id)) {
                this.sentByBot.del(m.key.id)
                continue
            }

            if (m.key.fromMe) {
                const tsSec = Number(m.messageTimestamp || 0)
                if (tsSec > 0 && Date.now() / 1000 - tsSec > 60) continue
            }

            if (m.key.fromMe && m.key.remoteJid) {
                const now = Date.now()
                const arr = (this.commandBurst.get(m.key.remoteJid) || []).filter(
                    (t) => now - t < RuntimeClient.LOOP_BURST_WINDOW_MS
                )
                if (arr.length >= RuntimeClient.LOOP_BURST_LIMIT) {
                    this.log(`Loop guard tripped for ${m.key.remoteJid} — dropping fromMe message`, true)
                    this.commandBurst.set(m.key.remoteJid, arr)
                    continue
                }
                arr.push(now)
                this.commandBurst.set(m.key.remoteJid, arr)
            }

            if (m.key.id) {
                const normalized = normalizeMessageContent(m.message)
                if (normalized) this.messageCache.set(m.key.id, normalized)
            }
            if (m.key.remoteJid) this.chats.add(m.key.remoteJid)
            fireAndForget(this.captureViewOnce(m as WAMessage))
            const simplifyStart = performance.now()
            this.emitNewMessage(this.simplifyMessage(m as WAMessage).then((simplified) => {
                ;(simplified as any)._simplifyDuration = performance.now() - simplifyStart
                return simplified
            }))
        }
    }

    private handleContactsUpsert = (contacts: Array<{ id?: string; notify?: string; name?: string; verifiedName?: string }>): void => {
        for (const c of contacts) {
            if (!c.id) continue
            this.contacts.set(c.id, { notify: c.notify || c.name, name: c.name, vname: c.verifiedName })
        }
    }

    private handleContactsUpdate = (contacts: Array<{ id?: string; notify?: string; name?: string; verifiedName?: string }>): void => {
        for (const c of contacts) {
            if (!c.id) continue
            const existing = this.contacts.get(c.id) || {}
            this.contacts.set(c.id, {
                ...existing,
                notify: c.notify || c.name || existing.notify,
                name: c.name || existing.name,
                vname: c.verifiedName || existing.vname
            })
        }
    }

    private handleGroupsUpdate = (updates: Array<{ id?: string }>): void => {
        for (const u of updates) { if (u.id) this.groupMetadataCache.del(u.id) }
    }

    private handleGroupParticipantsUpdate = (event: { id: string; participants: { id: string }[]; action: string; author?: string }): void => {
        this.groupMetadataCache.del(event.id)
        this.emit('group-participants-update', {
            jid: event.id,
            participants: event.participants,
            action: event.action,
            actor: event.author
        })
    }

    private handleCall = (calls: Array<{ id: string; from: string; status?: string; [key: string]: unknown }>): void => {
        for (const c of calls) { if (c.status === 'offer') this.emit('incoming-call', { id: c.id, from: c.from }) }
    }

    /** Cache directory for proactively-snapshotted view-once media. */
    private viewOnceDir = join(process.cwd(), 'cache', 'viewonce')
    private viewOncePruneTimer: NodeJS.Timeout | null = null

    // =========================================================================
    // SERVICES
    // =========================================================================

    private quotaService = new QuotaService(this.DB)
    private xpService = new XpService(this.DB)
    private viewOnceService = new ViewOnceService(this.viewOnceDir, (msg, isError) => this.log(msg, isError))
    private groups!: GroupService
    private userData = new UserDataService(this.DB)

    private captureViewOnce = (M: WAMessage): Promise<void> => this.viewOnceService.captureViewOnce(M)
    private pruneViewOnce = (): Promise<void> => this.viewOnceService.pruneViewOnce()
    getCapturedViewOnce = (id: string | null | undefined): Promise<{ buffer: Buffer; type: 'image' | 'video' } | undefined> =>
        this.viewOnceService.getCapturedViewOnce(id)

    /** Safe accessor — returns a copy of the asset buffer or undefined. */
    getAsset = (key: string): Buffer | undefined => this.assets.get(key)

    /** Internal: load an asset into the assets map (used by ResourceLoader at startup). */
    setAsset = (key: string, buffer: Buffer): void => { this.assets.set(key, buffer) }

    /** Safe accessor — count of loaded assets. */
    getAssetCount = (): number => this.assets.size

    /** Safe accessor — returns a snapshot copy of observed chat JIDs. */
    getChatsSnapshot = (): string[] => [...this.chats]

    /** Safe accessor — count of observed chats. */
    getChatCount = (): number => this.chats.size

    /** Safe accessor — count of known contacts. */
    getContactCount = (): number => this.contacts.size

    /** Safe accessor — count of loaded features. */
    getFeatureCount = (): number => this.features.size

    /** Required by makeWASocket: retrieve a previously-sent message by key for resends + poll decryption. */
    private getMessage = async (key: WAMessageKey): Promise<WAMessageContent | undefined> => {
        if (key.id && this.messageCache.has(key.id)) {
            const cached = this.messageCache.get<WAMessageContent>(key.id)
            return cached || undefined
        }
        return undefined
    }

    /** Group metadata cache hook — prevents redundant getGroupMetadata calls during message send. */
    private cachedGroupMetadata = async (jid: string): Promise<GroupMetadata | undefined> => {
        if (!isJidGroup(jid)) return undefined
        const cached = this.groupMetadataCache.get<GroupMetadata>(jid)
        if (cached) return cached
        try {
            const metadata = await this.sock.groupMetadata(jid)
            if (metadata) this.groupMetadataCache.set(jid, metadata)
            return metadata
        } catch {
            return undefined
        }
    }

    /** Don't process messages from broadcast lists or newsletters. */
    private shouldIgnoreJid = (jid: string): boolean => {
        if (!jid) return false
        if (isJidBroadcast(jid)) return true
        if (isJidNewsletter(jid)) return true
        return false
    }

    /** Track a bot-sent message ID so we can ignore its echo in messages.upsert. */
    private trackSent = (sent: WAMessage | undefined): void => {
        const id = sent?.key?.id
        if (id) this.sentByBot.set(id, true)
    }

    // =========================================================================
    // MESSAGING
    // =========================================================================

    sendMessage = async (
        jid: string,
        content: string | Buffer,
        type?: string,
        options: {
            caption?: string
            mimetype?: string
            contextInfo?: proto.IContextInfo
            quoted?: WAMessage
            thumbnail?: Buffer
        } = {}
    ): Promise<WAMessage | undefined> => {
        const mention = options.contextInfo?.mentionedJid as string[] | undefined
        const payload = buildMessageContent(
            content,
            type,
            options.mimetype,
            mention,
            options.caption,
            options.thumbnail
        )
        const sent = (await this.sock.sendMessage(jid, payload, { quoted: options.quoted })) as
            | WAMessage
            | undefined
        this.trackSent(sent)
        return sent
    }

    downloadMediaMessage = async (message: WAMessage): Promise<Buffer> => {
        const buffer = await baileysDownloadMediaMessage(message, 'buffer', {})
        return buffer as Buffer
    }

    // =========================================================================
    // GROUP OPERATIONS (delegated to GroupService)
    // =========================================================================

    groupMetadata = async (jid: string): Promise<GroupMetadata> => this.groups.groupMetadata(jid)
    fetchGroupMetadataFromWA = async (jid: string): Promise<GroupMetadata> => this.groups.fetchGroupMetadataFromWA(jid)
    groupRemove = async (jid: string, users: string[]) => this.groups.groupRemove(jid, users)
    groupPromote = async (jid: string, users: string[]) => this.groups.groupPromote(jid, users)
    groupDemote = async (jid: string, users: string[]) => this.groups.groupDemote(jid, users)
    groupAdd = async (jid: string, users: string[]) => this.groups.groupAdd(jid, users)
    groupInviteCode = async (jid: string): Promise<string | undefined> => this.groups.groupInviteCode(jid)
    groupRevokeInvite = async (jid: string): Promise<string | undefined> => this.groups.groupRevokeInvite(jid)
    groupUpdateSubject = async (jid: string, subject: string): Promise<void> => this.groups.groupUpdateSubject(jid, subject)
    groupUpdateDescription = async (jid: string, description: string): Promise<void> => this.groups.groupUpdateDescription(jid, description)
    groupAcceptInvite = async (code: string): Promise<string | undefined> => this.groups.groupAcceptInvite(code)
    groupLeave = async (jid: string): Promise<void> => this.groups.groupLeave(jid)
    groupMakeAdmin = async (jid: string, users: string[]) => this.groups.groupPromote(jid, users)
    groupDemoteAdmin = async (jid: string, users: string[]) => this.groups.groupDemote(jid, users)
    groupSettingChange = async (jid: string, _setting: string, value: boolean): Promise<void> => this.groups.groupSettingChange(jid, _setting, value)
    acceptInvite = async (code: string): Promise<{ status: number; gid?: string }> => this.groups.acceptInvite(code)

    sendPresenceUpdate = async (status: 'available' | 'composing' | 'recording' | 'paused'): Promise<void> => {
        await this.sock.sendPresenceUpdate(status)
    }

    // =========================================================================
    // CONTACTS & PROFILES
    // =========================================================================

    getProfilePicture = async (jid: string): Promise<Buffer | undefined> => {
        try {
            const url = await this.sock.profilePictureUrl(jid, 'image')
            if (!url) return undefined
            const res = await axios.get<Buffer>(url, { responseType: 'arraybuffer' })
            return res.data
        } catch {
            return undefined
        }
    }

    /** Returns the raw profile-picture URL string, or undefined if not found. */
    getProfilePictureUrl = async (jid: string): Promise<string | undefined> => {
        if (!this.sock) {
            this.log(`[jail] sock not ready for ${jid}`, true)
            return undefined
        }
        try {
            return await this.sock.profilePictureUrl(jid, 'image')
        } catch (err) {
            this.log(`[jail] profilePictureUrl failed for ${jid}: ${err instanceof Error ? err.message : String(err)}`, true)
            return undefined
        }
    }

    /** Returns the user's status text. v7's fetchStatus returns USyncQueryResultList[]. */
    getStatus = async (jid: string): Promise<{ status?: string; setAt?: Date }> => {
        try {
            const result = await this.sock.fetchStatus(jid)
            const first = (result as Array<{ status?: { status?: string; setAt?: Date } }> | undefined)?.[0]
            return { status: first?.status?.status, setAt: first?.status?.setAt }
        } catch {
            return {}
        }
    }

    onWhatsApp = async (...jids: string[]): Promise<{ exists: boolean; jid: string }[]> => {
        const out = await this.sock.onWhatsApp(...jids)
        return (out || []).map((r) => ({ exists: !!r.exists, jid: r.jid }))
    }

    // =========================================================================
    // CHAT OPERATIONS
    // =========================================================================

    /** Best-effort port of legacy modifyAllChats. v7 has no in-memory chat list, so this only acts on chats observed during this session. */
    modifyAllChats = async (
        action: 'archive' | 'unarchive' | 'pin' | 'unpin' | 'mute' | 'unmute' | 'delete' | 'clear'
    ): Promise<{ status: 200 | 500 }> => {
        try {
            for (const jid of this.chats) {
                if (action === 'archive' || action === 'unarchive') {
                    await this.sock.chatModify(
                        { archive: action === 'archive', lastMessages: [] },
                        jid
                    )
                } else if (action === 'mute' || action === 'unmute') {
                    await this.sock.chatModify({ mute: action === 'mute' ? 8 * 60 * 60 * 1000 : null }, jid)
                } else if (action === 'pin' || action === 'unpin') {
                    await this.sock.chatModify({ pin: action === 'pin' }, jid)
                } else if (action === 'delete') {
                    await this.sock.chatModify({ delete: true, lastMessages: [] }, jid)
                } else if (action === 'clear') {
                    await this.sock.chatModify({ clear: true, lastMessages: [] }, jid)
                }
            }
            return { status: 200 }
        } catch {
            return { status: 500 }
        }
    }

    deleteMessage = async (jid: string, key: WAMessageKey): Promise<void> => {
        await this.sock.sendMessage(jid, { delete: key })
    }

    /** Reject an incoming call. */
    rejectCall = async (callID: string, caller: string): Promise<void> => {
        try {
            await this.sock.rejectCall(callID, caller)
        } catch {
            /* call already gone */
        }
    }

    emitNewMessage = async (M: Promise<ISimplifiedMessage>): Promise<void> =>
        void this.emit('new-message', await M)

    // =========================================================================
    // JID UTILITIES
    // =========================================================================

    /** Resolve a JID (possibly @lid) to its preferred (PN) form. */
    pnForm = (jid: string | null | undefined, fallback?: string | null): string => {
        if (!jid) return fallback || ''
        if (jid.endsWith('@lid') && fallback && !fallback.endsWith('@lid')) return fallback
        return jid
    }

    /** Are two JIDs the same user (handles LID/PN, device suffixes, server differences)? */
    sameUser = (a: string | undefined, b: string | undefined): boolean => areJidsSameUser(a, b)

    // =========================================================================
    // MESSAGE PARSING (simplifyMessage + helpers)
    // =========================================================================

    /** Extract text content from a message based on its content type. */
    private static extractContent = (
        msgVal: Record<string, unknown>,
        type: string
    ): string | null => {
        if (type === 'conversation') return (msgVal.conversation as string) || null
        if (type === 'extendedTextMessage')
            return (msgVal.extendedTextMessage as { text?: string })?.text || null
        if (type === 'imageMessage' || type === 'videoMessage' || type === 'documentMessage')
            return (msgVal[type] as { caption?: string })?.caption || ''
        return null
    }

    /** Extract quoted message info from contextInfo. */
    private extractQuoted = (
        ctxInfo: proto.IContextInfo | undefined,
        remoteJid: string
    ): { message: WAMessage | null; sender: string | null } => {
        const quotedMessage = ctxInfo?.quotedMessage
        const quotedSender = ctxInfo?.participant ? jidNormalizedUser(ctxInfo.participant) : null
        return {
            message: quotedMessage
                ? ({
                      key: {
                          remoteJid,
                          id: ctxInfo?.stanzaId || undefined,
                          participant: ctxInfo?.participant || undefined,
                          fromMe: this.isMe(ctxInfo?.participant ?? undefined)
                      } as WAMessageKey,
                      message: quotedMessage
                  } as WAMessage)
                : null,
            sender: quotedSender
        }
    }

    /** Build a reply function bound to a specific chat. */
    private buildReplyFn = (remoteJid: string, original: WAMessage): ISimplifiedMessage['reply'] => {
        return async (replyContent, replyType = MessageType.text, mime, mention, caption, thumbnail) => {
            const payload = buildMessageContent(replyContent, replyType, mime, mention, caption, thumbnail)
            const sent = (await this.sock.sendMessage(remoteJid, payload, { quoted: original })) as
                | WAMessage
                | undefined
            this.trackSent(sent)
            return sent
        }
    }

    simplifyMessage = async (rawM: WAMessage): Promise<ISimplifiedMessage> => {
        const M = rawM
        const innerMessage = extractMessageContent(M.message) || M.message || {}
        const type = (getContentType(innerMessage) as string) || ''

        const remoteJid = M.key.remoteJid || ''
        const fromGroup = isJidGroup(remoteJid) === true
        const chat: 'group' | 'dm' = fromGroup ? 'group' : 'dm'
        const isFromMe = M.key.fromMe === true

        // Resolve sender in the group's native JID form so admin comparisons work.
        const senderRaw = fromGroup
            ? M.key.participant || (isFromMe ? this.user.jid : '')
            : isFromMe
              ? this.user.jid
              : remoteJid
        const sender = senderRaw ? jidNormalizedUser(senderRaw) : ''

        const info = this.getContact(sender)
        const groupMetadata: IExtendedGroupMetadata | null = fromGroup
            ? ((await this.cachedGroupMetadata(remoteJid)) as IExtendedGroupMetadata | undefined) ?? null
            : null
        if (groupMetadata) {
            groupMetadata.admins = groupMetadata.participants
                .filter((p) => p.admin === 'admin' || p.admin === 'superadmin')
                .map((p) => p.id)
        }

        const senderIsAdmin = !!groupMetadata?.admins?.some(
            (j) => j === sender || (isFromMe && this.isMe(j))
        )

        const senderInfo = {
            jid: sender,
            username:
                info.notify ||
                info.vname ||
                info.name ||
                M.pushName ||
                M.verifiedBizName ||
                sender.split('@')[0] ||
                'User',
            isAdmin: senderIsAdmin
        }

        const msgVal = innerMessage as Record<string, unknown>
        const content = RuntimeClient.extractContent(msgVal, type)
        const ctxInfo = (msgVal[type] as { contextInfo?: proto.IContextInfo } | undefined)?.contextInfo
        const quoted = this.extractQuoted(ctxInfo, remoteJid)
        const mentioned = (ctxInfo?.mentionedJid || []).filter((v): v is string => !!v)

        const args = (content || '').trim().split(/\s+/).filter(Boolean)
        const urls = this.util.getUrls(content || '')

        return {
            type,
            content,
            chat,
            sender: senderInfo,
            quoted,
            args,
            reply: this.buildReplyFn(remoteJid, M),
            mentioned,
            from: remoteJid,
            groupMetadata,
            WAMessage: M,
            urls
        }
    }

    getContact = (jid: string): IContactInfo => this.contacts.get(jid) || {}

    // =========================================================================
    // USER/GROUP DATA (delegated to UserDataService)
    // =========================================================================

    getUser = async (jid: string): Promise<IUserModel> => this.userData.getUser(jid)
    getMediaPreference = async (jid: string): Promise<'document' | 'audio' | 'video'> => this.userData.getMediaPreference(jid)

    getBuffer = async (url: string): Promise<Buffer> =>
        (await axios.get<Buffer>(url, { responseType: 'arraybuffer', timeout: 15_000 })).data

    fetch = async <T>(url: string): Promise<T> => (await axios.get<T>(url, { timeout: 15_000 })).data

    banUser = async (jid: string, reason?: string): Promise<void> => this.userData.banUser(jid, reason)
    unbanUser = async (jid: string): Promise<void> => this.userData.unbanUser(jid)

    // =========================================================================
    // FEATURES & COMMAND TOGGLES
    // =========================================================================

    /** Combined DB write + in-memory cache update for feature toggles. */
    toggleFeature = async (feature: string, state: boolean): Promise<void> => {
        await this.DB.feature.updateOne(
            { feature },
            { $set: { state } },
            { upsert: true }
        )
        this.features.set(feature, state)
    }

    /** Check whether a command is already disabled in the DB. */
    isCommandDisabled = async (command: string): Promise<boolean> => {
        const doc = await this.DB.disabledcommands.findOne({ command }).lean()
        return !!doc
    }

    /** Persist a disabled command to DB. */
    disableCommand = async (command: string, reason: string): Promise<void> => {
        await new this.DB.disabledcommands({ command, reason }).save()
    }

    /** Remove a disabled command from DB. */
    enableCommand = async (command: string): Promise<void> => {
        await this.DB.disabledcommands.deleteOne({ command })
    }

    setMediaPreference = async (jid: string, pref: 'document' | 'audio' | 'video'): Promise<void> =>
        this.userData.setMediaPreference(jid, pref)
    resetMediaPreference = async (jid: string): Promise<void> => this.userData.resetMediaPreference(jid)
    getBannedUsers = async (): Promise<Array<{ jid: string; banReason?: string }>> => this.userData.getBannedUsers()

    consumeChatQuota = (jid: string): Promise<{ allowed: boolean; remaining: number; limit: number }> =>
        this.quotaService.consumeChatQuota(jid)

    setChatQuotaLimit = (jid: string, limit: number): Promise<void> =>
        this.quotaService.setChatQuotaLimit(jid, limit)

    extendChatQuota = (jid: string, by: number): Promise<void> =>
        this.quotaService.extendChatQuota(jid, by)

    setChatEnabled = (jid: string, enabled: boolean, kind: 'user' | 'group'): Promise<void> =>
        this.quotaService.setChatEnabled(jid, enabled, kind)

    setXp = (jid: string, min: number, max: number): Promise<void> =>
        this.xpService.setXp(jid, min, max)

    getGroupData = async (jid: string): Promise<IGroupModel> => this.userData.getGroupData(jid)

    getFeatures = async (feature: string): Promise<IFeatureModel> =>
        (await this.DB.feature.findOneAndUpdate(
            { feature },
            { $setOnInsert: { feature } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )) as IFeatureModel

    setFeatures = async (): Promise<void> => {
        const dbfeatures = await this.DB.feature.find().lean()
        for (const feature of dbfeatures) this.features.set(feature.feature.toString(), feature.state)
    }

    isFeature = (feature: string): boolean => this.features.get(feature) || false

    setFeature = (feature: string, value: boolean): void => {
        this.features.set(feature, value)
    }

    /** Return disabled-command info for the pipeline cache. */
    getDisabledCommandInfo = async (command: string): Promise<{ command: string; reason: string } | null> => {
        const doc = await this.DB.disabledcommands.findOne({ command }).lean()
        return doc ? { command: doc.command, reason: doc.reason } : null
    }

    /** Return all disabled commands for the pipeline cache. */
    getAllDisabledCommands = async (): Promise<Array<{ command: string; reason: string }>> => {
        const docs = await this.DB.disabledcommands.find().lean()
        return docs.map((d: Record<string, unknown>) => ({
            command: d.command as string,
            reason: d.reason as string
        }))
    }

    // =========================================================================
    // DIAGNOSTICS
    // =========================================================================

    /** Public diagnostics for health endpoints — avoids unsafe private access. */
    getRuntimeDiagnostics(): {
        reconnectAttempts: number
        reconnectDelay: number
        reconnectActive: boolean
        timers: { total: number; timeouts: number; intervals: number }
    } {
        const state = this.reconnectBackoff.getState()
        const timerDiag = this.timerRegistry.getDiagnostics()
        return {
            reconnectAttempts: state.attempt,
            reconnectDelay: state.delay,
            reconnectActive: state.isActive,
            timers: { total: timerDiag.total, timeouts: timerDiag.timeouts, intervals: timerDiag.intervals }
        }
    }
}

export enum toggleableGroupActions {
    events = 'events',
    NSFW = 'nsfw',
    safe = 'safe',
    mod = 'mod',
    cmd = 'cmd',
    invitelink = 'invitelink'
}
