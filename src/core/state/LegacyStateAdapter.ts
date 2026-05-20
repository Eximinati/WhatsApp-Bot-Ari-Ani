import type { UserState, GroupState } from './StateManager.js'

export interface LegacyStateAdapterConfig {
    readonly dbModels: DBModels
}

export interface DBModels {
    user: any
    group: any
    session: any
    disabledcommands: any
    feature: any
    bond: any
    rizz: any
}

export class LegacyStateAdapter {
    private readonly db: DBModels

    constructor(config: LegacyStateAdapterConfig) {
        this.db = config.dbModels
    }

    async getUserState(jid: string): Promise<UserState | null> {
        try {
            const user = await this.db.user.findOne({ jid }).lean()
            if (!user) return null
            return Object.freeze({
                jid: user.jid,
                xp: user.Xp || 0,
                level: user.level || 0,
                isBanned: user.ban || false,
                isMod: user.isMod || false,
                lastSeen: user.lastSeen || 0
            })
        } catch {
            return null
        }
    }

    async getGroupState(jid: string): Promise<GroupState | null> {
        try {
            const group = await this.db.group.findOne({ jid }).lean()
            if (!group) return null
            return Object.freeze({
                jid: group.jid,
                isActive: group.active ?? true,
                participants: group.participants || [],
                settings: Object.freeze({
                    prefix: group.prefix || '!',
                    nsfw: group.nsfw || false,
                    events: group.events ?? true
                })
            })
        } catch {
            return null
        }
    }

    async isCommandDisabled(command: string, chatJid: string): Promise<boolean> {
        try {
            const disabled = await this.db.disabledcommands.findOne({
                command,
                jid: chatJid
            }).lean()
            return !!disabled
        } catch {
            return false
        }
    }

    async isFeatureEnabled(feature: string): Promise<boolean> {
        try {
            const featureDoc = await this.db.feature.findOne({ name: feature }).lean()
            return featureDoc?.enabled ?? false
        } catch {
            return false
        }
    }
}