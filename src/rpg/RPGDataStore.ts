/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, Document, Model } from 'mongoose'
import { PlayerProfile, CombatState, WorldState } from './types.js'

interface IPlayerDoc extends Document { jid: string; [key: string]: any }
interface ICombatDoc extends Document { playerJid: string; [key: string]: any }
interface IWorldDoc extends Document { [key: string]: any }

const PlayerSchema = new Schema<any>({ jid: { type: String, required: true, unique: true, index: true }, name: { type: String, required: true } }, { timestamps: true, strict: false, minimize: false })
const CombatSchema = new Schema<any>({ playerJid: { type: String, required: true, index: true } }, { strict: false, minimize: false })
const WorldSchema = new Schema<any>({}, { strict: false, minimize: false })

export const PlayerModel: Model<any> = mongoose.models.RPGPlayer || mongoose.model<any>('RPGPlayer', PlayerSchema)
export const CombatModel: Model<any> = mongoose.models.RPGCombat || mongoose.model<any>('RPGCombat', CombatSchema)
export const WorldModel: Model<any> = mongoose.models.RPGWorld || mongoose.model<any>('RPGWorld', WorldSchema)

function patchProfile(raw: Record<string, any>): PlayerProfile {
    raw.traits = raw.traits ?? []
    raw.titles = raw.titles ?? []
    raw.affinities = raw.affinities ?? []
    raw.inventory = raw.inventory ?? []
    raw.skills = raw.skills ?? []
    raw.mentalState = raw.mentalState ?? []
    raw.questsCompleted = raw.questsCompleted ?? []
    raw.eventsSeen = raw.eventsSeen ?? []
    raw.knownProphecies = raw.knownProphecies ?? []
    raw.personalityTestAnswers = raw.personalityTestAnswers ?? []
    raw.discoveredZones = raw.discoveredZones ?? ['survivor_camp']

    raw.stats = raw.stats ?? { strength: 1, agility: 1, endurance: 1, intelligence: 1, mana: 1 }
    raw.hiddenStats = raw.hiddenStats ?? { fate: 0, corruption: 0, authority: 0, divinity: 0, sanity: 100, bloodline: 0, killingIntent: 0, reputation: 0 }
    raw.psyche = raw.psyche ?? { fear: 0, trauma: 0, stress: 0, hunger: 0, confidence: 50, madness: 0 }
    raw.gauges = raw.gauges ?? { hp: 100, maxHp: 100, mp: 50, maxMp: 50, stamina: 100, maxStamina: 100 }
    raw.equipment = raw.equipment ?? {}
    raw.lastAction = raw.lastAction ?? {}
    raw.kills = raw.kills ?? {}

    raw.origin = raw.origin ?? 'random'
    raw.level = raw.level ?? 1
    raw.xp = raw.xp ?? 0
    raw.stage = raw.stage ?? 'awakened'
    raw.karma = raw.karma ?? 0
    raw.luck = raw.luck ?? 1
    raw.currency = raw.currency ?? 0
    raw.blackMarketTokens = raw.blackMarketTokens ?? 0
    raw.deaths = raw.deaths ?? 0
    raw.timelineFragments = raw.timelineFragments ?? 0
    raw.isRegressed = raw.isRegressed ?? false
    raw.createdAt = raw.createdAt ?? Date.now()
    raw.faction = raw.faction ?? undefined
    raw.factionRank = raw.factionRank ?? undefined
    raw.factionReputation = raw.factionReputation ?? undefined
    raw.evolutionPath = raw.evolutionPath ?? undefined
    raw.currentZone = raw.currentZone ?? 'survivor_camp'
    raw.characterImageUrl = raw.characterImageUrl ?? undefined

    if (!raw.titles.includes('survivor_of_the_first_night')) {
        raw.titles.push('survivor_of_the_first_night')
    }

    return raw as PlayerProfile
}

export class RPGDataStore {
    static async getPlayer(jid: string): Promise<PlayerProfile | null> {
        const doc = await PlayerModel.findOne({ jid })
        if (!doc) return null
        return patchProfile(doc.toObject())
    }

    static async createPlayer(jid: string, name: string): Promise<PlayerProfile> {
        const def: PlayerProfile = {
            jid, name, origin: 'random', level: 1, xp: 0, stage: 'origin_selection',
            personalityTestAnswers: [],
            stats: { strength: 1, agility: 1, endurance: 1, intelligence: 1, mana: 1 },
            hiddenStats: { fate: 0, corruption: 0, authority: 0, divinity: 0, sanity: 100, bloodline: 0, killingIntent: 0, reputation: 0 },
            psyche: { fear: 0, trauma: 0, stress: 0, hunger: 0, confidence: 50, madness: 0 },
            gauges: { hp: 100, maxHp: 100, mp: 50, maxMp: 50, stamina: 100, maxStamina: 100 },
            traits: [], affinities: [], titles: ['survivor_of_the_first_night'],
            karma: 0, luck: Math.floor(Math.random() * 10) + 1, mentalState: [],
            inventory: [{ itemId: 'expired_ration', quantity: 2 }], equipment: {}, skills: [], lastAction: {},
            currency: 10, blackMarketTokens: 0,
            questsCompleted: [], eventsSeen: [], kills: {}, deaths: 0,
            currentZone: 'survivor_camp', discoveredZones: ['survivor_camp'],
            knownProphecies: [], timelineFragments: 0, isRegressed: false, createdAt: Date.now()
        }
        await PlayerModel.create(def)
        return def
    }

    static async savePlayer(profile: PlayerProfile): Promise<void> {
        await PlayerModel.updateOne({ jid: profile.jid }, { $set: profile } as any, { upsert: true })
    }

    static async getCombat(jid: string): Promise<CombatState | null> {
        const doc = await CombatModel.findOne({ playerJid: jid })
        return doc ? (doc.toObject() as CombatState) : null
    }

    static async saveCombat(state: CombatState): Promise<void> {
        await CombatModel.updateOne({ playerJid: state.playerJid }, { $set: state } as any, { upsert: true })
    }

    static async deleteCombat(jid: string): Promise<void> {
        await CombatModel.deleteOne({ playerJid: jid })
    }

    static async getWorld(): Promise<WorldState> {
        let doc = await WorldModel.findOne()
        if (!doc) doc = await WorldModel.create({ era: 'The System Era - Year 0', day: 1, activeEvents: [], fallenCities: [], bossThreats: [], factionStatuses: {}, marketMultiplier: 1.0, globalScarcity: {}, currentSeason: 'calm' })
        return doc.toObject() as WorldState
    }

    static async saveWorld(state: WorldState): Promise<void> {
        await WorldModel.updateOne({}, { $set: state } as any, { upsert: true })
    }

    static async setCharacterImage(jid: string, url: string): Promise<PlayerProfile | null> {
        await PlayerModel.updateOne({ jid }, { $set: { characterImageUrl: url } } as any)
        return this.getPlayer(jid)
    }
}