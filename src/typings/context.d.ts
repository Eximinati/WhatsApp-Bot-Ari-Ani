import type { proto, WAMessage, WAMessageKey, GroupMetadata } from 'baileys'
import type {
    IConfig,
    IContactInfo,
    IExtendedGroupMetadata,
    IFeatureModel,
    IGroupModel,
    IUserModel
} from './index.js'

/** The stable, safe contract between RuntimeClient and Commands.
 *  Only includes APIs that are safe for command consumption — no raw
 *  DB access, no mutable shared state, no socket escape, no lifecycle
 *  internals.  This is the "what commands see" boundary. */
export interface ICommandContext {
    readonly config: IConfig

    readonly state: 'open' | 'connecting' | 'close'
    readonly QR?: Buffer

    readonly user: {
        jid: string
        id: string
        lid?: string
        name?: string
        notify?: string
        vname?: string
        short?: string
    }

    log(text: string, error?: boolean): void

    getRuntimeDiagnostics(): {
        reconnectAttempts: number
        reconnectDelay: number
        reconnectActive: boolean
        timers: { total: number; timeouts: number; intervals: number }
    }

    // --- Identity & Auth ---
    isMe(jid: string | null | undefined): boolean
    isMod(jid: string | null | undefined): boolean
    isBotAdmin(meta?: IExtendedGroupMetadata | null): boolean

    // --- Messaging ---
    sendMessage(
        jid: string,
        content: string | Buffer,
        type?: string,
        options?: {
            caption?: string
            mimetype?: string
            contextInfo?: proto.IContextInfo
            quoted?: WAMessage
            thumbnail?: Buffer
        }
    ): Promise<WAMessage | undefined>

    downloadMediaMessage(message: WAMessage): Promise<Buffer>

    sendPresenceUpdate(status: 'available' | 'composing' | 'recording' | 'paused'): Promise<void>

    deleteMessage(jid: string, key: WAMessageKey): Promise<void>

    modifyAllChats(
        action: 'archive' | 'unarchive' | 'pin' | 'unpin' | 'mute' | 'unmute' | 'delete' | 'clear'
    ): Promise<{ status: 200 | 500 }>

    // --- User & Group Data ---
    getUser(jid: string): Promise<IUserModel>
    getGroupData(jid: string): Promise<IGroupModel>
    getMediaPreference(jid: string): Promise<'document' | 'audio' | 'video'>

    getContact(jid: string): IContactInfo

    // --- Safe Asset Accessors ---
    getAsset(key: string): Buffer | undefined
    setAsset(key: string, buffer: Buffer): void
    getAssetCount(): number

    getChatsSnapshot(): string[]
    getChatCount(): number
    getContactCount(): number
    getFeatureCount(): number

    // --- Features ---
    getFeatures(feature: string): Promise<IFeatureModel>
    setFeatures(): Promise<void>
    isFeature(feature: string): boolean
    setFeature(feature: string, value: boolean): void

    // --- Quota & XP (via extracted services) ---
    consumeChatQuota(jid: string): Promise<{ allowed: boolean; remaining: number; limit: number }>
    setChatQuotaLimit(jid: string, limit: number): Promise<void>
    extendChatQuota(jid: string, by: number): Promise<void>
    setChatEnabled(jid: string, enabled: boolean, kind: 'user' | 'group'): Promise<void>
    setXp(jid: string, min: number, max: number): Promise<void>

    // --- Moderation ---
    banUser(jid: string, reason?: string): Promise<void>
    unbanUser(jid: string): Promise<void>

    // --- Feature / Command Toggle ---
    toggleFeature(feature: string, state: boolean): Promise<void>
    isCommandDisabled(command: string): Promise<boolean>
    disableCommand(command: string, reason: string): Promise<void>
    enableCommand(command: string): Promise<void>

    // --- User Settings ---
    setMediaPreference(jid: string, pref: 'document' | 'audio' | 'video'): Promise<void>
    resetMediaPreference(jid: string): Promise<void>

    // --- Queries ---
    getBannedUsers(): Promise<Array<{ jid: string; banReason?: string }>>
    getDisabledCommandInfo(command: string): Promise<{ command: string; reason: string } | null>
    getAllDisabledCommands(): Promise<Array<{ command: string; reason: string }>>

    // --- Group Operations ---
    groupMetadata(jid: string): Promise<GroupMetadata>
    fetchGroupMetadataFromWA(jid: string): Promise<GroupMetadata>
    groupRemove(jid: string, users: string[]): Promise<{ status: string; jid?: string }[]>
    groupPromote(jid: string, users: string[]): Promise<{ status: string; jid?: string }[]>
    groupDemote(jid: string, users: string[]): Promise<{ status: string; jid?: string }[]>
    groupAdd(jid: string, users: string[]): Promise<{ status: string; jid?: string }[]>
    groupInviteCode(jid: string): Promise<string | undefined>
    groupRevokeInvite(jid: string): Promise<string | undefined>
    groupUpdateSubject(jid: string, subject: string): Promise<void>
    groupUpdateDescription(jid: string, description: string): Promise<void>
    groupAcceptInvite(code: string): Promise<string | undefined>
    groupLeave(jid: string): Promise<void>
    groupMakeAdmin(jid: string, users: string[]): Promise<{ status: string; jid?: string }[]>
    groupDemoteAdmin(jid: string, users: string[]): Promise<{ status: string; jid?: string }[]>
    groupSettingChange(jid: string, _setting: string, value: boolean): Promise<void>
    acceptInvite(code: string): Promise<{ status: number; gid?: string }>

    // --- Contacts ---
    getProfilePicture(jid: string): Promise<Buffer | undefined>
    getProfilePictureUrl(jid: string): Promise<string | undefined>
    getStatus(jid: string): Promise<{ status?: string; setAt?: Date }>
    onWhatsApp(...jids: string[]): Promise<{ exists: boolean; jid: string }[]>

    // --- JID Utilities ---
    pnForm(jid: string | null | undefined, fallback?: string | null): string
    sameUser(a: string | undefined, b: string | undefined): boolean

    // --- View Once ---
    getCapturedViewOnce(id: string | null | undefined): Promise<{ buffer: Buffer; type: 'image' | 'video' } | undefined>

    // --- HTTP Utilities ---
    getBuffer(url: string): Promise<Buffer>
    fetch<T>(url: string): Promise<T>
}
