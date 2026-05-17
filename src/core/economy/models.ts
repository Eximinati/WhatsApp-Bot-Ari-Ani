import { Schema, model } from 'mongoose'
import type { IUserSettingModel, IFactionModel } from './types.js'

// ── UserSetting (economy account) ───────────────────────────────────────

const UserSettingSchema = new Schema<IUserSettingModel>({
    jid: { type: String, required: true, unique: true, index: true },
    wallet: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    inventoryJson: { type: String, default: '{}' },
    activeBuffsJson: { type: String, default: '[]' },
    economyStatsJson: { type: String, default: '{}' },
    jobKey: { type: String, default: '' },
    factionKey: { type: String, default: '' },
    equippedToolKey: { type: String, default: '' },
    factionJoinedAt: { type: Date, default: null },
    streakCount: { type: Number, default: 0 },
    streakDomain: { type: String, default: '' },
    lastStreakAt: { type: Date, default: null },
    lastDailyMoneyAt: { type: Date, default: null },
    lastFishAt: { type: Date, default: null },
    lastMineAt: { type: Date, default: null },
    lastHuntAt: { type: Date, default: null },
    lastBegAt: { type: Date, default: null },
    lastWorkAt: { type: Date, default: null },
    lastFarmAt: { type: Date, default: null },
    lastInvestAt: { type: Date, default: null },
    lastCollectAt: { type: Date, default: null },
    lastCrimeAt: { type: Date, default: null },
    lastRobAt: { type: Date, default: null },
    lastHeistAt: { type: Date, default: null },
    lastDuelAt: { type: Date, default: null },
    sessionCount: { type: Number, default: 0 },
    lastActionAt: { type: Date, default: null },
    rareMeter: { type: Number, default: 0 },
    lastRareMeterAt: { type: Date, default: null },
    failStreak: { type: Number, default: 0 },
    lastResult: { type: String, default: '' },
})

export const UserSetting = model<IUserSettingModel>(
    'economy_user_settings',
    UserSettingSchema,
)

// ── Faction ─────────────────────────────────────────────────────────────

const FactionSchema = new Schema<IFactionModel>({
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    treasury: { type: Number, default: 0 },
    memberCount: { type: Number, default: 0 },
    bonusProfile: {
        type: Schema.Types.Mixed,
        default: {},
    },
})

export const Faction = model<IFactionModel>('economy_factions', FactionSchema)