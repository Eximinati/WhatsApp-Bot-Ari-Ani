import type DataStore from '../pipeline/DataStore.js'

export default class QuotaService {
    constructor(private DB: DataStore) {}

    /** Atomic per-user quota gate. Resets daily; rolls forward `chatQuotaResetAt` to
     * 24h after first use of the new period. Returns whether the call is allowed and
     * the remaining count (post-decrement on success). */
    consumeChatQuota = async (jid: string): Promise<{ allowed: boolean; remaining: number; limit: number }> => {
        const now = new Date()
        const user = await this.DB.user.findOneAndUpdate(
            { jid },
            { $setOnInsert: { jid } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        const limit = typeof user.chatQuotaLimit === 'number' ? user.chatQuotaLimit : 20
        const resetAt = user.chatQuotaResetAt ? new Date(user.chatQuotaResetAt) : new Date(0)
        let used = typeof user.chatQuotaUsed === 'number' ? user.chatQuotaUsed : 0
        let nextReset = resetAt
        if (now >= resetAt) {
            used = 0
            nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000)
        }
        if (used >= limit) {
            await this.DB.user.updateOne(
                { jid },
                { $set: { chatQuotaUsed: used, chatQuotaResetAt: nextReset } }
            )
            return { allowed: false, remaining: 0, limit }
        }
        await this.DB.user.updateOne(
            { jid },
            { $set: { chatQuotaUsed: used + 1, chatQuotaResetAt: nextReset } }
        )
        return { allowed: true, remaining: Math.max(0, limit - (used + 1)), limit }
    }

    /** Set a hard quota limit for a user (mod action). */
    setChatQuotaLimit = async (jid: string, limit: number): Promise<void> => {
        await this.DB.user.findOneAndUpdate(
            { jid },
            { $set: { chatQuotaLimit: Math.max(0, Math.floor(limit)) }, $setOnInsert: { jid } },
            { upsert: true, setDefaultsOnInsert: true }
        )
    }

    /** Top up a user's remaining quota for the current period without changing their limit. */
    extendChatQuota = async (jid: string, by: number): Promise<void> => {
        const user = await this.DB.user.findOneAndUpdate(
            { jid },
            { $setOnInsert: { jid } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )
        const used = typeof user.chatQuotaUsed === 'number' ? user.chatQuotaUsed : 0
        const next = Math.max(0, used - Math.max(0, Math.floor(by)))
        await this.DB.user.updateOne({ jid }, { $set: { chatQuotaUsed: next } })
    }

    /** Toggle per-chat LLM auto-reply enablement (set on User for DMs, Group for groups). */
    setChatEnabled = async (jid: string, enabled: boolean, kind: 'user' | 'group'): Promise<void> => {
        if (kind === 'user') {
            await this.DB.user.findOneAndUpdate(
                { jid },
                { $set: { chatEnabled: enabled }, $setOnInsert: { jid } },
                { upsert: true, setDefaultsOnInsert: true }
            )
        } else {
            await this.DB.group.findOneAndUpdate(
                { jid },
                { $set: { chatEnabled: enabled }, $setOnInsert: { jid } },
                { upsert: true, setDefaultsOnInsert: true }
            )
        }
    }
}
