import RuntimeClient from './RuntimeClient.js'

interface PendingMedia {
    jid: string
    buffer: Buffer
    command: string
    title?: string
    type: 'audio' | 'video'
}

const pendingCache = new Map<string, { hasPending: boolean; expiresAt: number }>()
const CACHE_TTL = 2000

interface MediaMenuState {
    step: string
    commandName: string
    chatJid: string
    expiresAt: number
    mediaInfo?: {
        url: string
        title: string
        type: 'audio' | 'video'
    }
    playlistData?: {
        name: string
        total: number
        tracks: { url: string; title: string; artist: string; trackName: string }[]
        trackRange?: { start: number; end: number }
    }
}

const COMMAND_CONFIGS: Record<string, { label: string; options: { mode: string; label: string }[] }> = {
    video: {
        label: 'YouTube video',
        options: [
            { mode: 'video', label: 'video' },
            { mode: 'document', label: 'document' }
        ]
    },
    play: {
        label: 'YouTube audio',
        options: [
            { mode: 'audio', label: 'audio' },
            { mode: 'document', label: 'document' }
        ]
    },
    spotify: {
        label: 'Spotify audio',
        options: [
            { mode: 'audio', label: 'audio' },
            { mode: 'document', label: 'document' }
        ]
    },
    ytaudio: {
        label: 'YouTube audio',
        options: [
            { mode: 'audio', label: 'audio' },
            { mode: 'document', label: 'document' }
        ]
    },
    ytvideo: {
        label: 'YouTube video',
        options: [
            { mode: 'video', label: 'video' },
            { mode: 'document', label: 'document' }
        ]
    },
    tiktok: {
        label: 'TikTok video',
        options: [
            { mode: 'video', label: 'video' },
            { mode: 'document', label: 'document' }
        ]
    },
    instagram: {
        label: 'Instagram video',
        options: [
            { mode: 'video', label: 'video' },
            { mode: 'document', label: 'document' }
        ]
    }
}

export default class MediaMenu {
    private client: RuntimeClient
    private pendingBuffers: Map<string, PendingMedia> = new Map()
    private MENU_TTL_MS = 10 * 60 * 1000

    constructor(client: RuntimeClient) {
        this.client = client
    }

    getSupportedCommands(): string[] {
        return Object.keys(COMMAND_CONFIGS)
    }

    getCommandConfig(commandName: string) {
        return COMMAND_CONFIGS[commandName?.toLowerCase()] || null
    }

    parseMenuState(raw: string | undefined): MediaMenuState | null {
        if (!raw) return null
        try {
            const parsed = JSON.parse(raw)
            if (!parsed.step || !parsed.commandName || !parsed.chatJid) {
                return null
            }
            return parsed
        } catch {
            return null
        }
    }

    async saveMenuState(userJid: string, state: MediaMenuState): Promise<void> {
        await this.client.DB.user.updateOne(
            { jid: userJid },
            { $set: { mediaMenuState: JSON.stringify({ ...state, expiresAt: Date.now() + this.MENU_TTL_MS }) } },
            { upsert: true }
        )
        pendingCache.delete(userJid)
    }

    async getMenuState(userJid: string): Promise<MediaMenuState | null> {
        const user = await this.client.getUser(userJid)
        return this.parseMenuState((user as any).mediaMenuState)
    }

    async clearMenuState(userJid: string): Promise<void> {
        await this.client.DB.user.updateOne(
            { jid: userJid },
            { $unset: { mediaMenuState: 1 } }
        )
        this.pendingBuffers.delete(userJid)
        pendingCache.delete(userJid)
    }

    addPending(jid: string, buffer: Buffer, command: string, title?: string, type: 'audio' | 'video' = 'audio'): void {
        console.log(`[MediaMenu] addPending: jid=${jid}, command=${command}, title=${title}, bufferSize=${buffer.length}`)
        this.pendingBuffers.set(jid, { jid, buffer, command, title, type })
    }

    getPending(jid: string): PendingMedia | undefined {
        return this.pendingBuffers.get(jid)
    }

    async hasPending(userJid: string): Promise<boolean> {
        const cached = pendingCache.get(userJid)
        if (cached && Date.now() < cached.expiresAt) {
            return cached.hasPending
        }

        const state = await this.getMenuState(userJid)
        
        if (!state) {
            pendingCache.set(userJid, { hasPending: false, expiresAt: Date.now() + CACHE_TTL })
            return false
        }
        
        if (Date.now() > state.expiresAt) {
            await this.clearMenuState(userJid)
            pendingCache.set(userJid, { hasPending: false, expiresAt: Date.now() + CACHE_TTL })
            return false
        }
        
        pendingCache.set(userJid, { hasPending: true, expiresAt: Date.now() + CACHE_TTL })
        return true
    }

    createFormatActions(commandName: string): Record<string, { mode: string; remember: boolean }> {
        const config = this.getCommandConfig(commandName)
        if (!config) return {}

        const [primary, secondary] = config.options
        return {
            '1': { mode: primary.mode, remember: false },
            '2': { mode: primary.mode, remember: true },
            '3': { mode: secondary.mode, remember: false },
            '4': { mode: secondary.mode, remember: true }
        }
    }

    renderFormatMenu(commandName: string, title: string): string {
        const config = this.getCommandConfig(commandName)
        if (!config) return 'Reply with a valid number.'

        const [primary, secondary] = config.options
        const label = config.label

        return `*${label} format*
${title}

1. Send as ${primary.label}
2. Always send /${commandName} as ${primary.label}
3. Send as ${secondary.label}
4. Always send /${commandName} as ${secondary.label}
0. Cancel

Reply with a number.`
    }

    getMenuText(commandName: string, title: string): string {
        return this.renderFormatMenu(commandName, title)
    }

    parseMediaPreferences(raw: string | undefined): Record<string, string> {
        if (!raw) return {}
        try {
            return JSON.parse(raw)
        } catch {
            return {}
        }
    }

    async setPreference(userJid: string, commandName: string, mode: string): Promise<void> {
        const user = await this.client.getUser(userJid)
        const preferences = this.parseMediaPreferences((user as any).mediaPreferences)
        preferences[commandName?.toLowerCase()] = mode

        await this.client.DB.user.updateOne(
            { jid: userJid },
            { $set: { mediaPreferences: JSON.stringify(preferences) } }
        )
    }

    async handleReply(userJid: string, chatJid: string, text: string): Promise<{
        handled: boolean
        response?: string
        sendNow?: { mode: string; media: any }
        clearState?: boolean
    }> {
        const state = await this.getMenuState(userJid)
        
        if (!state) {
            return { handled: false }
        }

        if (Date.now() > state.expiresAt) {
            await this.clearMenuState(userJid)
            return { handled: true, response: '⌛ Session expired. Please run the command again.', clearState: true }
        }

        if (state.chatJid !== chatJid) {
            return { handled: false }
        }

        const trimmed = text.trim().toLowerCase()
        
        if (['0', 'cancel', 'back', 'menu', 'exit'].includes(trimmed)) {
            await this.clearMenuState(userJid)
            return { handled: true, response: '❌ Cancelled.', clearState: true }
        }

        if (!/^\d+$/.test(trimmed)) {
            return { handled: false }
        }

        if (state.step !== 'format') {
            return { handled: false }
        }

        const actions = this.createFormatActions(state.commandName)
        const action = actions[trimmed]

        if (!action) {
            return { handled: true, response: 'Reply with a valid number from the media format menu.' }
        }

        if (action.remember) {
            await this.setPreference(userJid, state.commandName, action.mode)
        }

        const mediaInfo = state.mediaInfo
        
        return {
            handled: true,
            sendNow: { mode: action.mode, media: mediaInfo },
            response: action.remember ? `Saved /${state.commandName} preference: *${action.mode}*. Use /media reset ${state.commandName} to ask again.` : undefined,
            clearState: true
        }
    }
}