import NodeCache from 'node-cache'
import RuntimeClient from './RuntimeClient.js'
import { ISimplifiedMessage } from '../typings/index.js'

const MENU_MAX_KEYS = 2000
const MENU_TTL_SECONDS = 600

export interface MenuSession {
    commandName: string
    chatJid: string
    step: string
    botMsgId?: string // Link to the specific message sent by the bot
    data?: any
    expiresAt: number
    onSelect?: (M: ISimplifiedMessage, index: number, input: string) => Promise<void> | void
}

export default class MenuManager {
    private cache: NodeCache
    private client: RuntimeClient

    constructor(client: RuntimeClient) {
        this.client = client
        this.cache = new NodeCache({
            stdTTL: MENU_TTL_SECONDS,
            useClones: false,
            maxKeys: MENU_MAX_KEYS,
            checkperiod: MENU_TTL_SECONDS
        })
        this.cache.on('evicted', (_key: string, _value: MenuSession[]) => {
            this.client.log(`[MenuManager] Session evicted due to maxKeys limit`)
        })
    }

    /**
     * Set or update a menu session for a user.
     * Stores sessions in a stack (array) per user.
     */
    set(userJid: string, session: Omit<MenuSession, 'expiresAt'>, ttlSeconds = 600): void {
        const expiresAt = Date.now() + ttlSeconds * 1000
        const newSession = { ...session, expiresAt }
        
        const sessions = this.getAll(userJid)
        
        // Remove existing session for the same command/step to avoid duplicates
        const filtered = sessions.filter(s => !(s.commandName === session.commandName && s.step === session.step))
        
        // Add new session to the top of the stack
        filtered.unshift(newSession)
        
        this.cache.set(userJid, filtered, ttlSeconds)
        this.client.log(`[MenuManager] Stack updated for ${userJid}. Current depth: ${filtered.length}`)
    }

    /**
     * Update the bot message ID for the most recent session of a command.
     */
    addId(userJid: string, commandName: string, botMsgId: string): void {
        const sessions = this.getAll(userJid)
        const session = sessions.find(s => s.commandName === commandName)
        if (session) {
            session.botMsgId = botMsgId
            this.cache.set(userJid, sessions)
            this.client.log(`[MenuManager] Linked session ${commandName} to msg ${botMsgId}`)
        }
    }

    /**
     * Get all active sessions for a user, filtered by expiry.
     */
    private getAll(userJid: string): MenuSession[] {
        const sessions = this.cache.get<MenuSession[]>(userJid) || []
        const now = Date.now()
        return sessions.filter(s => s.expiresAt > now)
    }

    /**
     * Clear all menu sessions for a user.
     */
    clearAll(userJid: string): void {
        this.cache.del(userJid)
    }

    /**
     * Clear sessions for a user.
     * If commandName is omitted, clears all sessions.
     */
    clear(userJid: string, commandName?: string, step?: string): void {
        const sessions = this.getAll(userJid)
        if (!commandName) {
            this.cache.del(userJid)
            return
        }
        
        const filtered = sessions.filter(s => !(s.commandName === commandName && (!step || s.step === step)))
        if (filtered.length === 0) {
            this.cache.del(userJid)
        } else {
            this.cache.set(userJid, filtered)
        }
    }

    /**
     * Check if a user has any active menu session.
     */
    has(userJid: string): boolean {
        return this.getAll(userJid).length > 0
    }

    /**
     * Global handler for number replies.
     * Uses Message-ID Anchoring first, then Fallback Stack.
     */
    async handleReply(M: ISimplifiedMessage): Promise<boolean> {
        const userJid = M.sender.jid
        const sessions = this.getAll(userJid)

        if (sessions.length === 0) return false

        const input = M.content?.trim() || ''
        const quotedId = M.quoted?.message?.key?.id

        let session: MenuSession | undefined

        // Strategy 1: Message-ID Anchoring (Priority)
        if (quotedId) {
            session = sessions.find(s => s.botMsgId === quotedId)
            if (session) this.client.log(`[MenuManager] Anchored session found via quote: ${session.commandName}`)
        }

        // Strategy 2: Fallback to Stack (Most Recent)
        if (!session) {
            // Only fallback if the message is in the same chat
            session = sessions.find(s => s.chatJid === M.from)
            if (session) this.client.log(`[MenuManager] Fallback session found: ${session.commandName}`)
        }

        if (!session) return false

        // Strategy 3: Handle Cancellation
        if (['0', 'cancel', 'exit', 'stop'].includes(input.toLowerCase())) {
            this.clear(userJid, session.commandName, session.step)
            await M.reply(`❌ ${session.commandName} cancelled.`)
            return true
        }

        // Only handle numeric inputs
        if (!/^\d+$/.test(input)) return false

        const index = parseInt(input)
        
        try {
            if (session.onSelect) {
                await session.onSelect(M, index, input)
                return true
            }

            const pipeline = this.client.pipeline
            const command = pipeline?.commands.get(session.commandName) || 
                            pipeline?.aliases.get(session.commandName)
            
            if (command && typeof (command as unknown as Record<string, unknown>).handleMenuSelection === 'function') {
                await (command as unknown as { handleMenuSelection: Function }).handleMenuSelection(M, session, index)
                return true
            }

            return false
        } catch (err) {
            this.client.log(`[MenuManager] Error handling reply for ${session.commandName}: ${err}`, true)
            await M.reply(`❌ Menu Error (${session.commandName}): ${err instanceof Error ? err.message : String(err)}`)
            return true
        }
    }

    getDiagnostics(): { cachedUsers: number; stats: { hits: number; misses: number; keys: number; ksize: number; vsize: number } } {
        return {
            cachedUsers: this.cache.keys().length,
            stats: this.cache.getStats()
        }
    }
}
