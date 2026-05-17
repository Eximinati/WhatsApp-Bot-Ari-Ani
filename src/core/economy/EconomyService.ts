import { constants } from './constants.js'
import { UserSetting, Faction } from './models.js'
import { extract } from './identity-resolver.js'
import { startOfTodayKey } from './schedule.js'
import {
    clampMoney,
    formatDurationMs,
    formatMoney,
    parseAmountInput,
    parseBetInput,
    parseInventory,
    parseJsonObject,
    randomBetween,
    stringifyInventory,
    totalWealth,
    sumDomainModifier,
    updateSession,
    applyRareMeterDecay,
    rollRareEvent,
    createBuffRecord,
    formatBalanceLines,
} from './utils.js'
import type {
    IEconomyBonusProfile,
    IEconomyShopItem,
    IEconomyJob,
    IActiveEntry,
    IActiveBuff,
    IPendingAction,
    IInventory,
    IEconomyStats,
    IBalanceSummary,
    IWealthLeaderboardRow,
    IGatherOptions,
    ITimedRewardResult,
    ICollectReward,
    IRobResult,
    IHeistResult,
    IDuelResult,
    IPayResult,
    ICoinFlipResult,
    IDiceResult,
    IBlackjackResult,
    IRouletteResult,
    IFactionInfo,
    IUserSettingModel,
} from './types.js'
import { REWARD_CAPS } from './types.js'

// ── Internal progression shape ─────────────────────────────────────────

interface IProgression {
    faction: IFactionInfo | null
    job: IEconomyJob | null
    equippedTool: IEconomyShopItem | null
    inventory: IInventory
    activeBuffs: IActiveEntry[]
    stats: IEconomyStats
}

function makePendingAction(params: {
    key: string
    label: string
    domain: string
    dueAt: number
    data: Record<string, unknown>
}): IPendingAction {
    return {
        key: params.key,
        label: params.label,
        type: 'pending',
        domain: params.domain,
        dueAt: new Date(params.dueAt).toISOString(),
        data: params.data,
    }
}

// ═══════════════════════════════════════════════════════════════════════
// EconomyService
// ═══════════════════════════════════════════════════════════════════════

export class EconomyService {
    private factionSeedPromise: Promise<void> | null = null

    // ── Faction seeding ────────────────────────────────────────────────

    async ensureFactions(): Promise<void> {
        if (!this.factionSeedPromise) {
            this.factionSeedPromise = Promise.all(
                constants.factions.map((faction) =>
                    Faction.updateOne(
                        { key: faction.key },
                        {
                            $setOnInsert: {
                                key: faction.key,
                                name: faction.name,
                                description: faction.description,
                                treasury: 0,
                                memberCount: 0,
                                bonusProfile: faction.bonusProfile || {},
                            },
                            $set: {
                                name: faction.name,
                                description: faction.description,
                                bonusProfile: faction.bonusProfile || {},
                            },
                        },
                        { upsert: true },
                    ),
                ),
            ).then(() => undefined)
        }
        await this.factionSeedPromise
    }

    // ── Static data ────────────────────────────────────────────────────

    getJobs(): IEconomyJob[] {
        return constants.jobs.map((j) => ({ ...j }))
    }

    getJob(key: string): IEconomyJob | null {
        return this.getJobs().find((j) => j.key === key) || null
    }

    getShopItems(): IEconomyShopItem[] {
        return constants.shopItems.map((i) => ({ ...i }))
    }

    getShopItem(key: string): IEconomyShopItem | null {
        return this.getShopItems().find((i) => i.key === key) || null
    }

    // ── Factions ───────────────────────────────────────────────────────

    async getFactions(): Promise<IFactionInfo[]> {
        await this.ensureFactions()
        const docs = await Faction.find({}).sort({ treasury: -1, memberCount: -1, name: 1 }).lean()
        const byKey = new Map(docs.map((d) => [d.key, d]))
        return constants.factions.map((faction) => {
            const doc = byKey.get(faction.key) || ({} as Record<string, unknown>)
            return {
                key: faction.key,
                name: faction.name,
                description: faction.description,
                treasury: clampMoney(doc.treasury as number),
                memberCount: clampMoney(doc.memberCount as number),
                bonusProfile: faction.bonusProfile || {},
            }
        })
    }

    async getFactionByKey(key: string): Promise<IFactionInfo | null> {
        const factions = await this.getFactions()
        return factions.find((f) => f.key === key) || null
    }

    // ── Parsing helpers ────────────────────────────────────────────────

    parseActiveBuffs(account: IUserSettingModel): IActiveEntry[] {
        try {
            const raw = JSON.parse(account.activeBuffsJson || '[]')
            if (!Array.isArray(raw)) return []
            return raw.filter(
                (e: unknown): e is IActiveEntry =>
                    typeof e === 'object' &&
                    e !== null &&
                    typeof (e as Record<string, unknown>).key === 'string' &&
                    ((e as Record<string, unknown>).type === 'buff' ||
                        (e as Record<string, unknown>).type === 'pending'),
            ) as IActiveEntry[]
        } catch {
            return []
        }
    }

    parseStats(account: IUserSettingModel): IEconomyStats {
        const obj = parseJsonObject(account.economyStatsJson) as Record<string, unknown>
        const stats: IEconomyStats = {}
        for (const [key, value] of Object.entries(obj)) {
            stats[key] = clampMoney(value as number)
        }
        return stats
    }

    // ── Account ────────────────────────────────────────────────────────

    async getAccount(jid: string): Promise<IUserSettingModel> {
        const id = extract(jid)
        const account = await UserSetting.findOneAndUpdate(
            { jid: id },
            { $setOnInsert: { jid: id } },
            { new: true, upsert: true, setDefaultsOnInsert: true },
        )
        if (!account) throw new Error(`Failed to upsert account for ${id}`)

        // Rare-meter decay
        const decayed = applyRareMeterDecay(account)
        if (decayed !== account.rareMeter) {
            account.rareMeter = decayed
            account.lastRareMeterAt = new Date()
            await account.save()
        }

        // Expired buff cleanup
        const buffs = this.parseActiveBuffs(account)
        const filtered = buffs.filter((entry) => {
            if (entry.type === 'buff' && entry.expiresAt) {
                return new Date(entry.expiresAt).getTime() > Date.now()
            }
            return true
        })
        if (JSON.stringify(buffs) !== JSON.stringify(filtered)) {
            account.activeBuffsJson = JSON.stringify(filtered)
            await account.save()
        }

        return account
    }

    // ── Progression ────────────────────────────────────────────────────

    async getProgression(account: IUserSettingModel): Promise<IProgression> {
        const faction = account.factionKey ? await this.getFactionByKey(account.factionKey) : null
        const job = this.getJob(account.jobKey)
        const equippedTool = this.getShopItem(account.equippedToolKey)
        const inventory = parseInventory(account.inventoryJson)
        const activeBuffs = this.parseActiveBuffs(account)
        const stats = this.parseStats(account)
        return { faction, job, equippedTool, inventory, activeBuffs, stats }
    }

    buildEntities(progression: IProgression): Array<{
        modifiers?: IEconomyBonusProfile | null
        bonusProfile?: IEconomyBonusProfile | null
    }> {
        const entities: Array<{
            modifiers?: IEconomyBonusProfile | null
            bonusProfile?: IEconomyBonusProfile | null
        }> = []
        if (progression.job) entities.push(progression.job)
        if (progression.faction) entities.push(progression.faction)
        if (progression.equippedTool?.modifiers) entities.push(progression.equippedTool)
        for (const buff of progression.activeBuffs) {
            if (buff.type === 'buff' && buff.modifiers) entities.push(buff)
        }
        return entities
    }

    // ── Multipliers ────────────────────────────────────────────────────

    getRewardMultiplier(progression: IProgression, domain: string): number {
        return 1 + sumDomainModifier(this.buildEntities(progression), 'reward', domain)
    }
    getPayoutMultiplier(progression: IProgression, domain: string): number {
        return 1 + sumDomainModifier(this.buildEntities(progression), 'payout', domain)
    }
    getCooldownMultiplier(progression: IProgression, domain: string): number {
        return Math.max(0.55, 1 + sumDomainModifier(this.buildEntities(progression), 'cooldown', domain))
    }
    getSuccessBonus(progression: IProgression, domain: string): number {
        return sumDomainModifier(this.buildEntities(progression), 'success', domain)
    }

    applyRewardMultiplier(value: number, progression: IProgression, domain: string): number {
        return clampMoney(Math.round(value * this.getRewardMultiplier(progression, domain)))
    }
    applyPayoutMultiplier(value: number, progression: IProgression, domain: string): number {
        return clampMoney(Math.round(value * this.getPayoutMultiplier(progression, domain)))
    }
    adjustCooldown(baseMs: number, progression: IProgression, domain: string): number {
        return Math.max(60_000, Math.round(baseMs * this.getCooldownMultiplier(progression, domain)))
    }

    // ── Cooldown ───────────────────────────────────────────────────────

    getRemainingCooldown(lastAt: Date | null | undefined, cooldownMs: number): number {
        if (!lastAt) return 0
        return Math.max(0, new Date(lastAt).getTime() + cooldownMs - Date.now())
    }
    formatCooldown(remainingMs: number): string {
        return formatDurationMs(remainingMs)
    }

    // ── Stats ──────────────────────────────────────────────────────────

    async incrementStats(account: IUserSettingModel, patch: Record<string, number>): Promise<void> {
        const stats = this.parseStats(account)
        for (const [key, value] of Object.entries(patch)) {
            stats[key] = clampMoney(stats[key] || 0) + clampMoney(value)
        }
        account.economyStatsJson = JSON.stringify(stats)
    }

    // ── Pending actions ────────────────────────────────────────────────

    readPendingAction(account: IUserSettingModel, key: string): IPendingAction | null {
        return (
            this.parseActiveBuffs(account).find(
                (e): e is IPendingAction => e.type === 'pending' && e.key === key,
            ) || null
        )
    }

    async upsertPendingAction(account: IUserSettingModel, pending: IPendingAction): Promise<void> {
        const buffs = this.parseActiveBuffs(account).filter(
            (e) => !(e.type === 'pending' && e.key === pending.key),
        )
        buffs.push(pending)
        account.activeBuffsJson = JSON.stringify(buffs)
    }

    async removePendingActions(account: IUserSettingModel, keys: string[]): Promise<void> {
        const keySet = new Set(keys)
        const buffs = this.parseActiveBuffs(account).filter(
            (e) => !(e.type === 'pending' && keySet.has(e.key)),
        )
        account.activeBuffsJson = JSON.stringify(buffs)
    }

    // ── Balance summary ────────────────────────────────────────────────

    toBalanceSummary(account: IUserSettingModel, progression?: IProgression | null): IBalanceSummary {
        const resolved: IProgression = progression || {
            inventory: parseInventory(account.inventoryJson),
            activeBuffs: this.parseActiveBuffs(account),
            stats: this.parseStats(account),
            job: this.getJob(account.jobKey),
            faction: null,
            equippedTool: this.getShopItem(account.equippedToolKey),
        }
        return {
            jid: account.jid,
            wallet: clampMoney(account.wallet),
            bank: clampMoney(account.bank),
            totalWealth: totalWealth(account),
            inventory: resolved.inventory,
            activeBuffs: resolved.activeBuffs,
            jobKey: account.jobKey || '',
            factionKey: account.factionKey || '',
            equippedToolKey: account.equippedToolKey || '',
            stats: resolved.stats,
        }
    }

    async getBalance(jid: string): Promise<IBalanceSummary> {
        const account = await this.getAccount(jid)
        return this.toBalanceSummary(account, await this.getProgression(account))
    }

    // ── Leaderboard ────────────────────────────────────────────────────

    async getWealthRank(jid: string): Promise<{ rank: number; totalWealth: number }> {
        const account = await this.getAccount(jid)
        const wealth = totalWealth(account)
        const richerCount = await UserSetting.countDocuments({
            $expr: { $gt: [{ $add: [{ $ifNull: ['$wallet', 0] }, { $ifNull: ['$bank', 0] }] }, wealth] },
        })
        return { rank: richerCount + 1, totalWealth: wealth }
    }

    async getWealthLeaderboard(limit = 10): Promise<IWealthLeaderboardRow[]> {
        const rows = await UserSetting.aggregate<IWealthLeaderboardRow>([
            {
                $project: {
                    jid: 1,
                    wallet: { $ifNull: ['$wallet', 0] },
                    bank: { $ifNull: ['$bank', 0] },
                    totalWealth: { $add: [{ $ifNull: ['$wallet', 0] }, { $ifNull: ['$bank', 0] }] },
                    jobKey: { $ifNull: ['$jobKey', ''] },
                    factionKey: { $ifNull: ['$factionKey', ''] },
                },
            },
            { $sort: { totalWealth: -1, bank: -1, wallet: -1 } },
            { $limit: limit },
        ])
        return rows.map((r) => ({
            ...r,
            wallet: clampMoney(r.wallet),
            bank: clampMoney(r.bank),
            totalWealth: clampMoney(r.totalWealth),
        }))
    }

    formatBalanceLines(balance: IBalanceSummary): string[] {
        return formatBalanceLines(balance)
    }

    // ── Wallet / bank ops ──────────────────────────────────────────────

    async addWallet(jid: string, amount: number): Promise<IBalanceSummary> {
        const account = await this.getAccount(jid)
        account.wallet = clampMoney(account.wallet + amount)
        await account.save()
        return this.toBalanceSummary(account, await this.getProgression(account))
    }

    async addBank(jid: string, amount: number): Promise<IBalanceSummary> {
        const account = await this.getAccount(jid)
        account.bank = clampMoney(account.bank + amount)
        await account.save()
        return this.toBalanceSummary(account, await this.getProgression(account))
    }

    async deposit(jid: string, amountInput: string | number): Promise<{ amount: number; account: IBalanceSummary }> {
        const account = await this.getAccount(jid)
        const amount = parseAmountInput(amountInput, account.wallet)
        account.wallet = clampMoney(account.wallet - amount)
        account.bank = clampMoney(account.bank + amount)
        await account.save()
        return { amount, account: this.toBalanceSummary(account, await this.getProgression(account)) }
    }

    async withdraw(jid: string, amountInput: string | number): Promise<{ amount: number; account: IBalanceSummary }> {
        const account = await this.getAccount(jid)
        const amount = parseAmountInput(amountInput, account.bank)
        account.bank = clampMoney(account.bank - amount)
        account.wallet = clampMoney(account.wallet + amount)
        await account.save()
        return { amount, account: this.toBalanceSummary(account, await this.getProgression(account)) }
    }

    // ── Daily cash ─────────────────────────────────────────────────────

    async claimDailyCash(jid: string, timezone = 'UTC'): Promise<{ claimed: boolean; reward: number; account: IBalanceSummary }> {
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const todayKey = startOfTodayKey(timezone)
        const lastKey = account.lastDailyMoneyAt ? startOfTodayKey(timezone, account.lastDailyMoneyAt) : ''
        if (account.lastDailyMoneyAt && lastKey === todayKey) {
            return { claimed: false, reward: 0, account: this.toBalanceSummary(account, progression) }
        }
        const reward = this.applyRewardMultiplier(
            randomBetween(constants.dailyCashMin, constants.dailyCashMax),
            progression,
            'daily',
        )
        account.wallet = clampMoney(account.wallet + reward)
        account.lastDailyMoneyAt = new Date()
        await this.incrementStats(account, { dailiesClaimed: 1 })
        await account.save()
        return { claimed: true, reward, account: this.toBalanceSummary(account, progression) }
    }

    // ── Streaks ────────────────────────────────────────────────────────

    async getStreakCount(jid: string, domain: string): Promise<number> {
        const id = extract(jid)
        const user = await UserSetting.findOne({ jid: id }).lean()
        if (!user || user.streakDomain !== domain) return 0
        if (!user.lastStreakAt) return 0
        if (Date.now() - new Date(user.lastStreakAt).getTime() > 5 * 60 * 1000) return 0
        return user.streakCount || 0
    }

    async updateStreak(jid: string, domain: string, success: boolean): Promise<number> {
        const id = extract(jid)
        const now = new Date()
        const STREAK_TIMEOUT = 5 * 60 * 1000
        if (success) {
            const result = await UserSetting.findOneAndUpdate(
                { jid: id, streakDomain: domain, lastStreakAt: { $gt: new Date(Date.now() - STREAK_TIMEOUT) } },
                { $inc: { streakCount: 1 }, $set: { lastStreakAt: now } },
                { new: true },
            )
            if (result) return result.streakCount
            await UserSetting.updateOne({ jid: id }, { $set: { streakCount: 1, streakDomain: domain, lastStreakAt: now } })
            return 1
        } else {
            await UserSetting.updateOne({ jid: id }, { $set: { streakCount: 0, streakDomain: '', lastStreakAt: null } })
            return 0
        }
    }

    // ── Timed reward ───────────────────────────────────────────────────

    async runTimedReward(params: {
        jid: string
        min: number
        max: number
        cooldownMs: number
        stampKey: 'lastBegAt' | 'lastWorkAt'
        successMessage: string
        domain: string
    }): Promise<ITimedRewardResult> {
        const id = extract(params.jid)
        const cooldownDate = new Date(Date.now() - params.cooldownMs)
        const account = await UserSetting.findOneAndUpdate(
            { jid: id, [params.stampKey]: { $lte: cooldownDate } },
            { $set: { [params.stampKey]: new Date() } },
            { new: true },
        )
        if (!account) {
            const existing = await this.getAccount(params.jid)
            const progression = await this.getProgression(existing)
            const remainingMs = this.getRemainingCooldown(
                (existing as unknown as Record<string, unknown>)[params.stampKey] as Date | null | undefined,
                params.cooldownMs,
            )
            return {
                ok: false, success: false, reason: 'cooldown', remainingMs,
                rareMeter: existing.rareMeter || 0, sessionCount: existing.sessionCount || 0,
                failStreak: existing.failStreak || 0, lastResult: existing.lastResult || '',
                account: this.toBalanceSummary(existing, progression),
            }
        }
        const progression = await this.getProgression(account)
        const sessionCount = updateSession(account)
        const failStreak = account.failStreak || 0
        const biasBoost = Math.min(failStreak * 0.02, 0.08)
        const successChance = 0.5 + biasBoost + this.getSuccessBonus(progression, params.domain)
        const isSuccess = Math.random() < successChance
        const reward = this.applyRewardMultiplier(randomBetween(params.min, params.max), progression, params.domain)
        const cap = REWARD_CAPS[params.domain] || Infinity
        const decayed = applyRareMeterDecay(account)
        account.rareMeter = decayed
        account.lastRareMeterAt = new Date()
        const currentRareMeter = account.rareMeter
        const rare = rollRareEvent(reward, params.min, params.domain, currentRareMeter)

        // Coin rare
        if (isSuccess && rare && rare.type === 'coins') {
            const rawReward = reward
            const rareBonus = rare?.bonus || 0
            const totalBeforeCap = rawReward + rareBonus
            const finalReward = Math.min(totalBeforeCap, cap)
            const appliedRare = Math.max(0, finalReward - rawReward)
            account.wallet = clampMoney(account.wallet + finalReward)
            account.rareMeter = 0
            account.lastRareMeterAt = new Date()
            account.failStreak = 0
            account.lastResult = 'win'
            await this.incrementStats(account, { [`${params.domain}Runs`]: 1 })
            await account.save()
            const newStreak = await this.updateStreak(params.jid, params.domain, true)
            console.log(`[ECONOMY] ${params.domain} | user=${id} | reward=${finalReward} | rare=${appliedRare} | streak=${newStreak}`)
            return {
                ok: true, success: true, reward: finalReward, streak: newStreak, rareMeter: 0,
                sessionCount, failStreak: 0, lastResult: 'win',
                rare: { type: rare.type, bonus: appliedRare, text: rare.text },
                message: params.successMessage,
                account: this.toBalanceSummary(account, progression),
            }
        }

        // Failure
        if (!isSuccess) {
            account.failStreak = Math.min((account.failStreak || 0) + 1, 10)
            account.lastResult = 'fail'
            await this.incrementStats(account, { [`${params.domain}Runs`]: 1 })
            await account.save()
            await this.updateStreak(params.jid, params.domain, false)
            return {
                ok: true, success: false, reward: 0, streak: 0,
                rareMeter: account.rareMeter || 0, sessionCount,
                failStreak: account.failStreak, lastResult: 'fail',
                message: params.successMessage,
                account: this.toBalanceSummary(account, progression),
            }
        }

        // Normal success
        const finalCapped = Math.min(reward, cap)
        account.rareMeter = Math.min((currentRareMeter || 0) + randomBetween(3, 7), 100)
        account.failStreak = 0
        account.lastResult = 'win'
        account.wallet = clampMoney(account.wallet + finalCapped)
        await this.incrementStats(account, { [`${params.domain}Runs`]: 1 })
        await account.save()
        const newStreak = await this.updateStreak(params.jid, params.domain, true)
        console.log(`[ECONOMY] ${params.domain} | user=${id} | reward=${finalCapped} | streak=${newStreak}`)
        return {
            ok: true, success: true, reward: finalCapped, streak: newStreak,
            rareMeter: account.rareMeter, sessionCount, failStreak: 0, lastResult: 'win',
            message: params.successMessage,
            account: this.toBalanceSummary(account, progression),
        }
    }

    async beg(jid: string): Promise<ITimedRewardResult> {
        return this.runTimedReward({
            jid, min: constants.begMin, max: constants.begMax, cooldownMs: constants.begCooldownMs,
            stampKey: 'lastBegAt', successMessage: 'A kind stranger tossed you some pocket cash.', domain: 'beg',
        })
    }

    async work(jid: string): Promise<ITimedRewardResult> {
        return this.runTimedReward({
            jid, min: constants.workMin, max: constants.workMax, cooldownMs: constants.workCooldownMs,
            stampKey: 'lastWorkAt', successMessage: 'You finished a focused shift.', domain: 'work',
        })
    }

    // ── Gather ─────────────────────────────────────────────────────────

    async performGather(jid: string, options: IGatherOptions): Promise<ITimedRewardResult> {
        const id = extract(jid)
        const cooldownDate = new Date(Date.now() - options.cooldownMs)
        const account = await UserSetting.findOneAndUpdate(
            { jid: id, [options.stampKey]: { $lte: cooldownDate } },
            { $set: { [options.stampKey]: new Date() } },
            { new: true },
        )
        if (!account) {
            const existing = await this.getAccount(jid)
            const progression = await this.getProgression(existing)
            const remainingMs = this.getRemainingCooldown(
                (existing as unknown as Record<string, unknown>)[options.stampKey] as Date | null | undefined,
                options.cooldownMs,
            )
            return {
                ok: false, success: false, reason: 'cooldown', remainingMs,
                rareMeter: existing.rareMeter || 0, sessionCount: existing.sessionCount || 0,
                failStreak: existing.failStreak || 0, lastResult: existing.lastResult || '',
                account: this.toBalanceSummary(existing, progression),
            }
        }
        const progression = await this.getProgression(account)
        const sessionCount = updateSession(account)
        const failStreak = account.failStreak || 0
        const biasBoost = Math.min(failStreak * 0.02, 0.08)
        const successRate = Math.min(0.95, 1 - options.missRate + this.getSuccessBonus(progression, options.domain) + biasBoost)

        if (Math.random() > successRate) {
            account.failStreak = Math.min((account.failStreak || 0) + 1, 10)
            account.lastResult = 'fail'
            await this.incrementStats(account, { [`${options.domain}Fails`]: 1 })
            await account.save()
            await this.updateStreak(jid, options.domain, false)
            return {
                ok: true, success: false, reward: 0, streak: 0,
                rareMeter: account.rareMeter || 0, sessionCount,
                failStreak: account.failStreak, lastResult: 'fail',
                message: options.failMessage,
                account: this.toBalanceSummary(account, progression),
            }
        }

        const decayed = applyRareMeterDecay(account)
        account.rareMeter = decayed
        account.lastRareMeterAt = new Date()
        const baseReward = this.applyRewardMultiplier(randomBetween(options.min, options.max), progression, options.domain)
        const cap = REWARD_CAPS[options.domain] || Infinity
        const currentRareMeter = account.rareMeter || 0
        const rare = rollRareEvent(baseReward, options.min, options.domain, currentRareMeter)

        // Coin rare
        if (rare && rare.type === 'coins') {
            const rawReward = baseReward
            const rareBonus = rare?.bonus || 0
            const totalBeforeCap = rawReward + rareBonus
            const finalReward = Math.min(totalBeforeCap, cap)
            const appliedRare = Math.max(0, finalReward - rawReward)
            account.wallet = clampMoney(account.wallet + finalReward)
            account.rareMeter = 0
            account.lastRareMeterAt = new Date()
            account.failStreak = 0
            account.lastResult = 'win'
            await this.incrementStats(account, { [`${options.domain}Runs`]: 1, [`${options.domain}Wins`]: 1 })
            await account.save()
            const newStreak = await this.updateStreak(jid, options.domain, true)
            console.log(`[ECONOMY] ${options.domain} | user=${id} | reward=${finalReward} | rare=${appliedRare} | streak=${newStreak}`)
            return {
                ok: true, success: true, reward: finalReward, streak: newStreak, rareMeter: 0,
                sessionCount, failStreak: 0, lastResult: 'win',
                rare: { type: rare.type, bonus: appliedRare, text: rare.text },
                message: options.successMessage,
                account: this.toBalanceSummary(account, progression),
            }
        }

        // Normal success
        const finalReward = Math.min(baseReward, cap)
        account.rareMeter = Math.min((currentRareMeter || 0) + randomBetween(3, 7), 100)
        account.failStreak = 0
        account.lastResult = 'win'
        account.wallet = clampMoney(account.wallet + finalReward)
        await this.incrementStats(account, { [`${options.domain}Runs`]: 1, [`${options.domain}Wins`]: 1 })
        await account.save()
        const newStreak = await this.updateStreak(jid, options.domain, true)
        console.log(`[ECONOMY] ${options.domain} | user=${id} | reward=${finalReward} | streak=${newStreak}`)
        return {
            ok: true, success: true, reward: finalReward, streak: newStreak,
            rareMeter: account.rareMeter, sessionCount, failStreak: 0, lastResult: 'win',
            message: options.successMessage,
            account: this.toBalanceSummary(account, progression),
        }
    }

    async fish(jid: string): Promise<ITimedRewardResult> {
        return this.performGather(jid, {
            domain: 'fish', stampKey: 'lastFishAt', cooldownMs: constants.fishCooldownMs,
            min: constants.fishMin, max: constants.fishMax, missRate: constants.fishMissRate,
            successMessage: 'You reeled in a profitable catch.', failMessage: 'The fish got away this time.',
        })
    }
    async mine(jid: string): Promise<ITimedRewardResult> {
        return this.performGather(jid, {
            domain: 'mine', stampKey: 'lastMineAt', cooldownMs: constants.mineCooldownMs,
            min: constants.mineMin, max: constants.mineMax, missRate: constants.mineMissRate,
            successMessage: 'You dug up a valuable haul.', failMessage: 'Nothing useful came out of that shift.',
        })
    }
    async hunt(jid: string): Promise<ITimedRewardResult> {
        return this.performGather(jid, {
            domain: 'hunt', stampKey: 'lastHuntAt', cooldownMs: constants.huntCooldownMs,
            min: constants.huntMin, max: constants.huntMax, missRate: constants.huntMissRate,
            successMessage: 'You returned with a strong hunting reward.', failMessage: 'Your trail went cold and the hunt came up empty.',
        })
    }

    // ── Farm ───────────────────────────────────────────────────────────

    async farm(jid: string): Promise<
        | { ok: true; reward: number; readyAt: string; message: string; account: IBalanceSummary }
        | { ok: false; reason: string; remainingMs?: number; readyAt?: string; pending?: IPendingAction; account: IBalanceSummary }
    > {
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const existing = this.readPendingAction(account, 'farm-crop')
        if (existing) {
            const dueAt = new Date(existing.dueAt).getTime()
            if (dueAt <= Date.now()) {
                return { ok: false, reason: 'ready', readyAt: existing.dueAt, pending: existing, account: this.toBalanceSummary(account, progression) }
            }
            return { ok: false, reason: 'growing', remainingMs: Math.max(0, dueAt - Date.now()), pending: existing, account: this.toBalanceSummary(account, progression) }
        }
        const reward = this.applyRewardMultiplier(randomBetween(constants.farmMin, constants.farmMax), progression, 'farm')
        const durationMs = this.adjustCooldown(constants.farmCooldownMs, progression, 'farm')
        const pending = makePendingAction({ key: 'farm-crop', label: 'Farm Plot', domain: 'farm', dueAt: Date.now() + durationMs, data: { reward } })
        account.lastFarmAt = new Date()
        await this.upsertPendingAction(account, pending)
        await this.incrementStats(account, { farmRuns: 1 })
        await account.save()
        return { ok: true, reward, readyAt: pending.dueAt, message: 'You planted a high-value crop. Come back with /collect later.', account: this.toBalanceSummary(account, progression) }
    }

    // ── Invest ─────────────────────────────────────────────────────────

    async invest(jid: string, amountInput: string | number): Promise<
        | { ok: true; amount: number; expectedPayout: number; readyAt: string; message: string; account: IBalanceSummary }
        | { ok: false; reason: string; remainingMs?: number; pending?: IPendingAction; account: IBalanceSummary }
    > {
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const existing = this.readPendingAction(account, 'investment')
        if (existing) {
            const dueAt = new Date(existing.dueAt).getTime()
            return { ok: false, reason: dueAt <= Date.now() ? 'ready' : 'pending', remainingMs: Math.max(0, dueAt - Date.now()), pending: existing, account: this.toBalanceSummary(account, progression) }
        }
        const amount = parseAmountInput(amountInput, account.wallet)
        if (amount < constants.investMinAmount) throw new Error(`Minimum investment is ${formatMoney(constants.investMinAmount)}.`)
        const isLoss = Math.random() < constants.investLossRate
        const multiplier = this.getPayoutMultiplier(progression, 'invest')
        let outcomeMessage: string
        let payout: number
        if (isLoss) {
            payout = 0
            outcomeMessage = 'Your investment performed poorly this cycle.'
        } else {
            const raw = randomBetween(Math.round(amount * constants.investMinMultiplier), Math.round(amount * constants.investMaxMultiplier))
            payout = this.applyPayoutMultiplier(raw, progression, 'invest')
            outcomeMessage = 'Your investment grew nicely.'
        }
        const durationMs = this.adjustCooldown(constants.investDurationMs, progression, 'invest')
        const pending = makePendingAction({ key: 'investment', label: 'Investment', domain: 'invest', dueAt: Date.now() + durationMs, data: { principal: amount, payout, multiplier } })
        account.wallet = clampMoney(account.wallet - amount)
        account.lastInvestAt = new Date()
        await this.upsertPendingAction(account, pending)
        await this.incrementStats(account, { investmentsMade: 1 })
        await account.save()
        return {
            ok: true, amount, expectedPayout: payout, readyAt: pending.dueAt, message: outcomeMessage,
            account: this.toBalanceSummary(account, progression),
        }
    }

    // ── Collect ────────────────────────────────────────────────────────

    async collect(jid: string): Promise<
        | { ok: true; total: number; rewards: ICollectReward[]; account: IBalanceSummary }
        | { ok: false; reason: string; remainingMs?: number; next?: IPendingAction | null; account: IBalanceSummary }
    > {
        const id = extract(jid)
        const cooldownDate = new Date(Date.now() - constants.collectCooldownMs)
        const account = await UserSetting.findOneAndUpdate(
            { jid: id, lastCollectAt: { $lte: cooldownDate } },
            { $set: { lastCollectAt: new Date() } },
            { new: true },
        )
        if (!account) {
            const existing = await this.getAccount(jid)
            const progression = await this.getProgression(existing)
            const remainingMs = this.getRemainingCooldown(existing.lastCollectAt, constants.collectCooldownMs)
            return { ok: false, reason: 'cooldown', remainingMs, account: this.toBalanceSummary(existing, progression) }
        }
        const progression = await this.getProgression(account)
        const pending = this.parseActiveBuffs(account).filter((e): e is IPendingAction => e.type === 'pending')
        const ready = pending.filter((e) => new Date(e.dueAt).getTime() <= Date.now())
        if (!ready.length) {
            const next = pending.map((e) => ({ ...e, remainingMs: Math.max(0, new Date(e.dueAt).getTime() - Date.now()) })).sort((a, b) => a.remainingMs - b.remainingMs)[0] || null
            return { ok: false, reason: next ? 'not-ready' : 'empty', next, account: this.toBalanceSummary(account, progression) }
        }
        let total = 0
        const rewards: ICollectReward[] = []
        for (const entry of ready) {
            const d = entry.data as { payout?: number; reward?: number; principal?: number }
            const payout = clampMoney(d?.payout || d?.reward || 0)
            total += payout
            rewards.push({ key: entry.key, label: entry.label, amount: payout, principal: clampMoney(d?.principal || 0) })
        }
        account.wallet = clampMoney(account.wallet + total)
        await this.removePendingActions(account, ready.map((e) => e.key))
        await this.incrementStats(account, { collections: 1 })
        await account.save()
        return { ok: true, total, rewards, account: this.toBalanceSummary(account, progression) }
    }

    // ── Crime ──────────────────────────────────────────────────────────

    async crime(jid: string): Promise<ITimedRewardResult> {
        const id = extract(jid)
        const cooldownDate = new Date(Date.now() - constants.crimeCooldownMs)
        const account = await UserSetting.findOneAndUpdate(
            { jid: id, lastCrimeAt: { $lte: cooldownDate } },
            { $set: { lastCrimeAt: new Date() } },
            { new: true },
        )
        if (!account) {
            const existing = await this.getAccount(jid)
            const progression = await this.getProgression(existing)
            const remainingMs = this.getRemainingCooldown(existing.lastCrimeAt, constants.crimeCooldownMs)
            return { ok: false, success: false, reason: 'cooldown', remainingMs, account: this.toBalanceSummary(existing, progression) }
        }
        const progression = await this.getProgression(account)
        const successRate = Math.min(0.95, constants.crimeSuccessRate + this.getSuccessBonus(progression, 'crime'))
        const success = Math.random() < successRate
        const amount = this.applyRewardMultiplier(
            randomBetween(success ? constants.crimeSuccessMin : constants.crimeFailMin, success ? constants.crimeSuccessMax : constants.crimeFailMax),
            progression, 'crime',
        )
        if (success) {
            account.wallet = clampMoney(account.wallet + amount)
            await this.incrementStats(account, { crimesWon: 1 })
            console.log(`[ECONOMY] crime | user=${id} | reward=${amount} | success=true`)
        } else {
            account.wallet = clampMoney(account.wallet - amount)
            await this.incrementStats(account, { crimesLost: 1 })
            console.log(`[ECONOMY] crime | user=${id} | loss=${amount}`)
        }
        await account.save()
        return {
            ok: true,
            success,
            reward: amount,
            message: success ? 'Your shady move paid off.' : 'You got caught and paid the price.',
            account: this.toBalanceSummary(account, progression),
        }
    }

    // ── Rob ────────────────────────────────────────────────────────────

    async rob(fromJid: string, targetJid: string): Promise<IRobResult> {
        if (fromJid === targetJid) throw new Error('You cannot rob yourself.')
        const thiefId = extract(fromJid)
        const [thief, target] = await Promise.all([this.getAccount(fromJid), this.getAccount(targetJid)])
        const cooldownDate = new Date(Date.now() - constants.robCooldownMs)
        const updatedThief = await UserSetting.findOneAndUpdate(
            { jid: thiefId, lastRobAt: { $lte: cooldownDate } },
            { $set: { lastRobAt: new Date() } },
            { new: true },
        )
        if (!updatedThief) {
            const progression = await this.getProgression(thief)
            const remainingMs = this.getRemainingCooldown(thief.lastRobAt, constants.robCooldownMs)
            return { ok: false, reason: 'cooldown', remainingMs, thief: this.toBalanceSummary(thief, progression), target: this.toBalanceSummary(target) }
        }
        const progression = await this.getProgression(updatedThief)
        if (clampMoney(target.wallet) < constants.robMinTargetWallet) {
            return { ok: false, reason: 'poor-target', thief: this.toBalanceSummary(updatedThief, progression), target: this.toBalanceSummary(target) }
        }
        const success = Math.random() < Math.min(0.95, constants.robSuccessRate + this.getSuccessBonus(progression, 'rob'))
        if (success) {
            const amount = Math.min(clampMoney(target.wallet), this.applyRewardMultiplier(randomBetween(constants.robMinSteal, constants.robMaxSteal), progression, 'rob'))
            updatedThief.wallet = clampMoney(updatedThief.wallet + amount)
            target.wallet = clampMoney(target.wallet - amount)
            await this.incrementStats(updatedThief, { robsWon: 1 })
            await Promise.all([updatedThief.save(), target.save()])
            return { ok: true, success: true, amount, message: "You slipped away with someone else's cash.", thief: this.toBalanceSummary(updatedThief, progression), target: this.toBalanceSummary(target) }
        }
        const penalty = this.applyRewardMultiplier(randomBetween(constants.robFailMin, constants.robFailMax), progression, 'rob')
        updatedThief.wallet = clampMoney(updatedThief.wallet - penalty)
        target.wallet = clampMoney(target.wallet + penalty)
        await this.incrementStats(updatedThief, { robsLost: 1 })
        await Promise.all([updatedThief.save(), target.save()])
        return { ok: true, success: false, amount: penalty, message: 'The robbery failed and you paid compensation.', thief: this.toBalanceSummary(updatedThief, progression), target: this.toBalanceSummary(target) }
    }

    // ── Heist ──────────────────────────────────────────────────────────

    async heist(fromJid: string, targetJid: string): Promise<IHeistResult> {
        if (fromJid === targetJid) throw new Error('You cannot heist yourself.')
        const thiefId = extract(fromJid)
        const [thief, target] = await Promise.all([this.getAccount(fromJid), this.getAccount(targetJid)])
        const cooldownDate = new Date(Date.now() - constants.heistCooldownMs)
        const updatedThief = await UserSetting.findOneAndUpdate(
            { jid: thiefId, lastHeistAt: { $lte: cooldownDate } },
            { $set: { lastHeistAt: new Date() } },
            { new: true },
        )
        if (!updatedThief) {
            const progression = await this.getProgression(thief)
            const remainingMs = this.getRemainingCooldown(thief.lastHeistAt, constants.heistCooldownMs)
            return { ok: false, success: false, reason: 'cooldown', remainingMs, thief: this.toBalanceSummary(thief, progression), target: this.toBalanceSummary(target) }
        }
        const progression = await this.getProgression(updatedThief)
        if (clampMoney(target.bank) < constants.heistMinTargetBank) {
            return { ok: false, reason: 'poor-target', thief: this.toBalanceSummary(updatedThief, progression), target: this.toBalanceSummary(target) }
        }
        const success = Math.random() < Math.min(0.92, constants.heistSuccessRate + this.getSuccessBonus(progression, 'heist'))
        if (success) {
            const amount = Math.min(clampMoney(target.bank), this.applyRewardMultiplier(randomBetween(constants.heistMinSteal, constants.heistMaxSteal), progression, 'heist'))
            updatedThief.wallet = clampMoney(updatedThief.wallet + amount)
            target.bank = clampMoney(target.bank - amount)
            await this.incrementStats(updatedThief, { heistsWon: 1 })
            await Promise.all([updatedThief.save(), target.save()])
            return { ok: true, success: true, amount, message: 'You cracked the vault and escaped with the payout.', thief: this.toBalanceSummary(updatedThief, progression), target: this.toBalanceSummary(target) }
        }
        const penalty = this.applyRewardMultiplier(randomBetween(constants.heistFailMin, constants.heistFailMax), progression, 'heist')
        updatedThief.wallet = clampMoney(updatedThief.wallet - penalty)
        target.bank = clampMoney(target.bank + penalty)
        await this.incrementStats(updatedThief, { heistsLost: 1 })
        await Promise.all([updatedThief.save(), target.save()])
        return { ok: true, success: false, amount: penalty, message: 'Security locked you out and you paid a brutal penalty.', thief: this.toBalanceSummary(updatedThief, progression), target: this.toBalanceSummary(target) }
    }

    // ── Duel ───────────────────────────────────────────────────────────

    async duel(fromJid: string, targetJid: string, betInput: string | number): Promise<IDuelResult> {
        if (fromJid === targetJid) throw new Error('You cannot duel yourself.')
        const challengerId = extract(fromJid)
        const [challenger, target] = await Promise.all([this.getAccount(fromJid), this.getAccount(targetJid)])
        const cooldownDate = new Date(Date.now() - constants.duelCooldownMs)
        const updatedChallenger = await UserSetting.findOneAndUpdate(
            { jid: challengerId, lastDuelAt: { $lte: cooldownDate } },
            { $set: { lastDuelAt: new Date() } },
            { new: true },
        )
        if (!updatedChallenger) {
            const progression = await this.getProgression(challenger)
            const remainingMs = this.getRemainingCooldown(challenger.lastDuelAt, constants.duelCooldownMs)
            return { ok: false, success: false, reason: 'cooldown', remainingMs, bet: 0, challenger: this.toBalanceSummary(challenger, progression), target: this.toBalanceSummary(target) }
        }
        const progression = await this.getProgression(updatedChallenger)
        const available = Math.min(updatedChallenger.wallet, target.wallet)
        const bet = parseBetInput(betInput, { minBet: constants.duelMinBet, maxBet: constants.duelMaxBet, available })
        const challengerPower = randomBetween(35, 100) + Math.round(this.getSuccessBonus(progression, 'duel') * 100)
        const targetPower = randomBetween(35, 100)
        if (challengerPower === targetPower) {
            await updatedChallenger.save()
            return { ok: true, draw: true, bet, challenger: this.toBalanceSummary(updatedChallenger, progression), target: this.toBalanceSummary(target) }
        }
        const challengerWins = challengerPower > targetPower
        const winner = challengerWins ? updatedChallenger : target
        const loser = challengerWins ? target : updatedChallenger
        winner.wallet = clampMoney(winner.wallet + bet)
        loser.wallet = clampMoney(loser.wallet - bet)
        await this.incrementStats(updatedChallenger, { [challengerWins ? 'duelsWon' : 'duelsLost']: 1 } as Record<string, number>)
        await Promise.all([updatedChallenger.save(), target.save()])
        return {
            ok: true, draw: false, winnerJid: challengerWins ? fromJid : targetJid, bet,
            challengerPower, targetPower,
            challenger: this.toBalanceSummary(updatedChallenger, progression), target: this.toBalanceSummary(target),
        }
    }

    // ── Pay ────────────────────────────────────────────────────────────

    async pay(fromJid: string, toJid: string, amountInput: string | number): Promise<IPayResult> {
        if (fromJid === toJid) throw new Error('You cannot pay yourself.')
        const [sender, receiver] = await Promise.all([this.getAccount(fromJid), this.getAccount(toJid)])
        const amount = parseAmountInput(amountInput, sender.wallet)
        sender.wallet = clampMoney(sender.wallet - amount)
        receiver.wallet = clampMoney(receiver.wallet + amount)
        await this.incrementStats(sender, { paymentsSent: 1 })
        await Promise.all([sender.save(), receiver.save()])
        return { amount, sender: this.toBalanceSummary(sender), receiver: this.toBalanceSummary(receiver) }
    }

    // ── Coinflip ───────────────────────────────────────────────────────

    async coinflip(jid: string, choice: string | undefined, betInput: string | number): Promise<ICoinFlipResult> {
        const normalized = String(choice ?? '').trim().toLowerCase()
        if (!['heads', 'tails'].includes(normalized)) throw new Error('Choose heads or tails.')
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const bet = parseBetInput(betInput, { minBet: constants.coinflipMinBet, maxBet: constants.coinflipMaxBet, available: account.wallet })
        const bias = this.getSuccessBonus(progression, 'coinflip')
        const isHeads = Math.random() < Math.min(0.6, Math.max(0.4, 0.5 + bias))
        const result = isHeads ? 'heads' : 'tails'
        const win = normalized === result
        const delta = bet
        account.wallet = clampMoney(account.wallet + (win ? delta : -delta))
        await this.incrementStats(account, { coinflipPlayed: 1, [win ? 'coinflipWon' : 'coinflipLost']: 1 })
        await account.save()
        return { win, choice: normalized, result, bet, delta, account: this.toBalanceSummary(account, progression) }
    }

    // ── Dice ───────────────────────────────────────────────────────────

    async dice(jid: string, betInput: string | number): Promise<IDiceResult> {
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const bet = parseBetInput(betInput, { minBet: constants.diceMinBet, maxBet: constants.diceMaxBet, available: account.wallet })
        const player = randomBetween(1, 6) + (this.getSuccessBonus(progression, 'dice') > 0 ? 1 : 0)
        const house = randomBetween(1, 6)
        const resolvedPlayer = Math.min(6, player)
        let win = false
        let draw = false
        let delta = 0
        if (resolvedPlayer === house) { draw = true }
        else if (resolvedPlayer > house) { win = true; delta = bet }
        else { delta = -bet }
        account.wallet = clampMoney(account.wallet + delta)
        await this.incrementStats(account, { dicePlayed: 1, [draw ? 'diceDraws' : win ? 'diceWon' : 'diceLost']: 1 })
        await account.save()
        return { win, draw, bet, player: resolvedPlayer, house, delta, account: this.toBalanceSummary(account, progression) }
    }

    // ── Blackjack ──────────────────────────────────────────────────────

    drawBlackjackHand(): { player: number[]; dealer: number[]; playerTotal: number; dealerTotal: number } {
        const deck = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11]
        const drawCard = () => deck[randomBetween(0, deck.length - 1)]
        const total = (hand: number[]): number => {
            let sum = hand.reduce((a, v) => a + v, 0)
            let aces = hand.filter((c) => c === 11).length
            while (sum > 21 && aces > 0) { sum -= 10; aces-- }
            return sum
        }
        const player = [drawCard(), drawCard()]
        const dealer = [drawCard(), drawCard()]
        while (total(player) < 16) player.push(drawCard())
        while (total(dealer) < 17) dealer.push(drawCard())
        return { player, dealer, playerTotal: total(player), dealerTotal: total(dealer) }
    }

    async blackjack(jid: string, betInput: string | number): Promise<IBlackjackResult> {
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const bet = parseBetInput(betInput, { minBet: constants.blackjackMinBet, maxBet: constants.blackjackMaxBet, available: account.wallet })
        const hand = this.drawBlackjackHand()
        let outcome: 'win' | 'lose' | 'draw' = 'lose'
        let delta = -bet
        const playerBust = hand.playerTotal > 21
        const dealerBust = hand.dealerTotal > 21
        if (playerBust && dealerBust) { outcome = 'draw'; delta = 0 }
        else if (!playerBust && (dealerBust || hand.playerTotal > hand.dealerTotal)) { outcome = 'win'; delta = clampMoney(Math.round(bet * 1.5)) }
        else if (!playerBust && hand.playerTotal === hand.dealerTotal) { outcome = 'draw'; delta = 0 }
        account.wallet = clampMoney(account.wallet + delta)
        await this.incrementStats(account, { blackjackPlayed: 1, [outcome === 'draw' ? 'blackjackDraws' : outcome === 'win' ? 'blackjackWon' : 'blackjackLost']: 1 })
        await account.save()
        return { outcome, win: outcome === 'win', bet, delta, ...hand, account: this.toBalanceSummary(account, progression) }
    }

    // ── Roulette ───────────────────────────────────────────────────────

    async roulette(jid: string, betType: string | undefined, betInput: string | number): Promise<IRouletteResult> {
        const normalized = String(betType ?? '').trim().toLowerCase()
        if (!normalized) throw new Error('Choose red, black, green, or a number from 0 to 12.')
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const bet = parseBetInput(betInput, { minBet: constants.rouletteMinBet, maxBet: constants.rouletteMaxBet, available: account.wallet })
        const spin = randomBetween(0, 12)
        const color = spin === 0 ? 'green' : spin % 2 === 0 ? 'black' : 'red'
        const pickedNumber = Number.parseInt(normalized, 10)
        let win = false
        let delta = -bet
        if (Number.isInteger(pickedNumber) && String(pickedNumber) === normalized) {
            win = pickedNumber === spin
            delta = win ? bet * 8 : -bet
        } else if (['red', 'black', 'green'].includes(normalized)) {
            win = normalized === color
            delta = win ? bet * (normalized === 'green' ? 10 : 2) : -bet
        } else {
            throw new Error('Roulette bet must be red, black, green, or a number from 0 to 12.')
        }
        account.wallet = clampMoney(account.wallet + delta)
        await this.incrementStats(account, { roulettePlayed: 1, [win ? 'rouletteWon' : 'rouletteLost']: 1 })
        await account.save()
        return { win, bet, spin, color, selection: normalized, delta: clampMoney(Math.abs(delta)), account: this.toBalanceSummary(account, progression) }
    }

    // ── Reward game / label ────────────────────────────────────────────

    async rewardGame(jid: string, reward: { cash?: number; xp?: number } | null | undefined): Promise<IBalanceSummary> {
        if (!reward?.cash) return this.getBalance(jid)
        return this.addWallet(jid, reward.cash)
    }

    getRewardLabel(reward: { cash?: number; xp?: number } | null | undefined): string {
        if (!reward) return ''
        const parts = [reward.xp ? `${reward.xp} XP` : '', reward.cash ? formatMoney(reward.cash) : '']
        return parts.filter(Boolean).join(' + ')
    }

    // ── Inventory / shop ───────────────────────────────────────────────

    async getInventory(jid: string): Promise<{
        account: IBalanceSummary
        items: Array<IEconomyShopItem & { quantity: number; equipped: boolean }>
        activeBuffs: IActiveEntry[]
    }> {
        const account = await this.getAccount(jid)
        const progression = await this.getProgression(account)
        const items = this.getShopItems()
            .map((item) => ({ ...item, quantity: clampMoney(progression.inventory[item.key]), equipped: account.equippedToolKey === item.key }))
            .filter((item) => item.quantity > 0)
        return { account: this.toBalanceSummary(account, progression), items, activeBuffs: progression.activeBuffs.filter((e): e is IActiveBuff => e.type === 'buff') }
    }

    async buy(jid: string, key: string, quantityInput: string | number = '1'): Promise<{
        item: IEconomyShopItem; quantity: number; totalPrice: number; account: IBalanceSummary; inventory: IInventory
    }> {
        const item = this.getShopItem(key)
        if (!item) throw new Error('Unknown shop item.')
        const account = await this.getAccount(jid)
        const quantity = parseAmountInput(quantityInput, Math.floor(clampMoney(account.wallet) / item.price))
        const totalPrice = item.price * quantity
        const inventory = parseInventory(account.inventoryJson)
        inventory[item.key] = clampMoney(inventory[item.key] || 0) + quantity
        account.wallet = clampMoney(account.wallet - totalPrice)
        account.inventoryJson = stringifyInventory(inventory)
        await this.incrementStats(account, { itemsBought: quantity })
        await account.save()
        const progression = await this.getProgression(account)
        return { item, quantity, totalPrice, account: this.toBalanceSummary(account, progression), inventory: progression.inventory }
    }

    async equip(jid: string, key: string): Promise<{ item: IEconomyShopItem; account: IBalanceSummary }> {
        const item = this.getShopItem(key)
        if (!item) throw new Error('Unknown item.')
        if (item.type !== 'tool') throw new Error('Only tool items can be equipped.')
        const account = await this.getAccount(jid)
        const inventory = parseInventory(account.inventoryJson)
        if (clampMoney(inventory[item.key]) <= 0) throw new Error('You do not own that tool yet.')
        account.equippedToolKey = item.key
        await account.save()
        return { item, account: this.toBalanceSummary(account, await this.getProgression(account)) }
    }

    async useItem(jid: string, key: string): Promise<{ item: IEconomyShopItem; account: IBalanceSummary; activeBuffs: IActiveEntry[] }> {
        const item = this.getShopItem(key)
        if (!item) throw new Error('Unknown item.')
        if (item.type !== 'consumable') throw new Error('Only consumable items can be used.')
        const account = await this.getAccount(jid)
        const inventory = parseInventory(account.inventoryJson)
        if (clampMoney(inventory[item.key]) <= 0) throw new Error('You do not own that item.')
        inventory[item.key] = clampMoney(inventory[item.key] - 1)
        const buffs = this.parseActiveBuffs(account).filter((e) => !(e.type === 'buff' && e.key === item.key))
        buffs.push(createBuffRecord(item))
        account.inventoryJson = stringifyInventory(inventory)
        account.activeBuffsJson = JSON.stringify(buffs)
        await this.incrementStats(account, { consumablesUsed: 1 })
        await account.save()
        const progression = await this.getProgression(account)
        return { item, account: this.toBalanceSummary(account, progression), activeBuffs: progression.activeBuffs.filter((e): e is IActiveBuff => e.type === 'buff') }
    }

    // ── Jobs ───────────────────────────────────────────────────────────

    async getJobsState(jid: string): Promise<{ currentJob: IEconomyJob | null; jobs: IEconomyJob[] }> {
        const account = await this.getAccount(jid)
        return { currentJob: this.getJob(account.jobKey), jobs: this.getJobs() }
    }

    async setJob(jid: string, key: string): Promise<{ job: IEconomyJob; account: IBalanceSummary }> {
        const job = this.getJob(key)
        if (!job) throw new Error('Unknown job key.')
        const account = await this.getAccount(jid)
        account.jobKey = job.key
        await account.save()
        return { job, account: this.toBalanceSummary(account) }
    }

    // ── Faction membership ─────────────────────────────────────────────

    async joinFaction(jid: string, key: string): Promise<{ faction: IFactionInfo; account: IBalanceSummary }> {
        const faction = await this.getFactionByKey(key)
        if (!faction) throw new Error('Unknown faction key.')
        const account = await this.getAccount(jid)
        if (account.factionKey === key) throw new Error('You are already in that faction.')
        if (account.factionKey) throw new Error('Leave your current faction before joining another one.')
        account.factionKey = key
        account.factionJoinedAt = new Date()
        await Promise.all([account.save(), Faction.updateOne({ key }, { $inc: { memberCount: 1 } })])
        return { faction: (await this.getFactionByKey(key)) as IFactionInfo, account: this.toBalanceSummary(account) }
    }

    async leaveFaction(jid: string): Promise<{ factionKey: string; account: IBalanceSummary }> {
        const account = await this.getAccount(jid)
        if (!account.factionKey) throw new Error('You are not in a faction.')
        const factionKey = account.factionKey
        account.factionKey = ''
        account.factionJoinedAt = null
        await Promise.all([account.save(), Faction.updateOne({ key: factionKey }, { $inc: { memberCount: -1 } })])
        return { factionKey, account: this.toBalanceSummary(account) }
    }

    async getFactionInfo(key: string, jid = ''): Promise<IFactionInfo> {
        const account = jid ? await this.getAccount(jid) : null
        const effectiveKey = key || account?.factionKey || ''
        if (!effectiveKey) throw new Error('No faction selected.')
        const faction = await this.getFactionByKey(effectiveKey)
        if (!faction) throw new Error('Unknown faction key.')
        return faction
    }

    async getFactionTop(limit = 10): Promise<IFactionInfo[]> {
        await this.ensureFactions()
        const rows = await Faction.find({}).sort({ treasury: -1, memberCount: -1, name: 1 }).limit(limit).lean()
        return rows.map((row) => ({
            key: row.key,
            name: row.name,
            description: row.description,
            treasury: clampMoney(row.treasury),
            memberCount: clampMoney(row.memberCount),
            bonusProfile: row.bonusProfile || {},
        }))
    }

    async donateFaction(jid: string, amountInput: string | number): Promise<{ amount: number; faction: IFactionInfo; account: IBalanceSummary }> {
        const account = await this.getAccount(jid)
        if (!account.factionKey) throw new Error('Join a faction before donating.')
        const amount = parseAmountInput(amountInput, account.wallet)
        account.wallet = clampMoney(account.wallet - amount)
        await Promise.all([account.save(), Faction.updateOne({ key: account.factionKey }, { $inc: { treasury: amount } })])
        return { amount, faction: (await this.getFactionByKey(account.factionKey)) as IFactionInfo, account: this.toBalanceSummary(account) }
    }
}