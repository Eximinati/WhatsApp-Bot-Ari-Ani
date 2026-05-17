import type { Document } from 'mongoose'

// ── Shop / job / faction contracts ──────────────────────────────────────

export interface IEconomyBonusProfile {
    reward?: Record<string, number>
    payout?: Record<string, number>
    cooldown?: Record<string, number>
    success?: Record<string, number>
}

export interface IEconomyShopItem {
    key: string
    name: string
    type: 'tool' | 'consumable' | 'buff'
    price: number
    durationMs?: number
    modifiers?: IEconomyBonusProfile
}

export interface IEconomyJob {
    key: string
    name: string
    modifiers?: IEconomyBonusProfile
}

export interface IEconomyFactionDefinition {
    key: string
    name: string
    description: string
    bonusProfile?: IEconomyBonusProfile
}

// ── Active buff / pending action ────────────────────────────────────────

export interface IActiveBuff {
    key: string
    name: string
    type: 'buff'
    expiresAt: string // ISO 8601
    modifiers?: IEconomyBonusProfile
}

export interface IPendingAction {
    key: string
    label: string
    type: 'pending'
    domain: string
    dueAt: string // ISO 8601
    data: Record<string, unknown>
}

export type IActiveEntry = IActiveBuff | IPendingAction

// ── Inventory (key → quantity) ──────────────────────────────────────────

export interface IInventory {
    [itemKey: string]: number
}

// ── Economy stats (loose key → number map) ──────────────────────────────

export interface IEconomyStats {
    [key: string]: number
}

// ── Balance summary ─────────────────────────────────────────────────────

export interface IBalanceSummary {
    jid: string
    wallet: number
    bank: number
    totalWealth: number
    inventory: IInventory
    activeBuffs: IActiveEntry[]
    jobKey: string
    factionKey: string
    equippedToolKey: string
    stats: IEconomyStats
}

// ── Wealth leaderboard row ──────────────────────────────────────────────

export interface IWealthLeaderboardRow {
    jid: string
    wallet: number
    bank: number
    totalWealth: number
    jobKey: string
    factionKey: string
}

// ── Reward caps ─────────────────────────────────────────────────────────

export const REWARD_CAPS: Record<string, number> = {
    fish: 500,
    mine: 800,
    hunt: 700,
    beg: 100,
    work: 150,
}

// ── Rare event ──────────────────────────────────────────────────────────

export interface IRareEvent {
    text: string
    type: 'coins' | 'xp' | 'multi'
    bonusMult: number
    bonus?: number
    xpBonus?: number
}

// ── Timed reward result ─────────────────────────────────────────────────

export interface ITimedRewardResult {
    ok: boolean
    success?: boolean
    reason?: string
    remainingMs?: number
    reward?: number
    streak?: number
    rareMeter?: number
    sessionCount?: number
    failStreak?: number
    lastResult?: string
    rare?: { type: string; bonus: number; text: string }
    message?: string
    account: IBalanceSummary
}

// ── Gather options ──────────────────────────────────────────────────────

export interface IGatherOptions {
    domain: string
    stampKey: string
    cooldownMs: number
    min: number
    max: number
    missRate: number
    successMessage: string
    failMessage: string
}

// ── Pending action detail for collect ───────────────────────────────────

export interface ICollectReward {
    key: string
    label: string
    amount: number
    principal: number
}

// ── Rob / heist / duel / pay return shapes ──────────────────────────────

export interface IRobResult {
    ok: boolean
    success?: boolean
    reason?: string
    remainingMs?: number
    amount?: number
    message?: string
    thief: IBalanceSummary
    target: IBalanceSummary
}

export interface IHeistResult {
    ok: boolean
    success?: boolean
    reason?: string
    remainingMs?: number
    amount?: number
    message?: string
    thief: IBalanceSummary
    target: IBalanceSummary
}

export interface IDuelResult {
    ok: boolean
    success?: boolean
    reason?: string
    remainingMs?: number
    draw?: boolean
    winnerJid?: string
    bet: number
    challengerPower?: number
    targetPower?: number
    challenger: IBalanceSummary
    target: IBalanceSummary
}

export interface IPayResult {
    amount: number
    sender: IBalanceSummary
    receiver: IBalanceSummary
}

export interface IBetResult {
    win: boolean
    draw?: boolean
    bet: number
    delta: number
    account: IBalanceSummary
}

export interface ICoinFlipResult extends IBetResult {
    choice: string
    result: string
}

export interface IDiceResult extends IBetResult {
    player: number
    house: number
}

export interface IBlackjackHand {
    player: number[]
    dealer: number[]
    playerTotal: number
    dealerTotal: number
}

export interface IBlackjackResult extends IBetResult {
    outcome: 'win' | 'lose' | 'draw'
    player: number[]
    dealer: number[]
    playerTotal: number
    dealerTotal: number
}

export interface IRouletteResult extends IBetResult {
    spin: number
    color: string
    selection: string
}

// ── Faction info ────────────────────────────────────────────────────────

export interface IFactionInfo {
    key: string
    name: string
    description: string
    treasury: number
    memberCount: number
    bonusProfile: IEconomyBonusProfile
}

// ── UserSetting Mongoose document ───────────────────────────────────────

export interface IUserSetting {
    jid: string
    wallet: number
    bank: number
    inventoryJson: string
    activeBuffsJson: string
    economyStatsJson: string
    jobKey: string
    factionKey: string
    equippedToolKey: string
    factionJoinedAt: Date | null
    streakCount: number
    streakDomain: string
    lastStreakAt: Date | null
    lastDailyMoneyAt: Date | null
    lastFishAt: Date | null
    lastMineAt: Date | null
    lastHuntAt: Date | null
    lastBegAt: Date | null
    lastWorkAt: Date | null
    lastFarmAt: Date | null
    lastInvestAt: Date | null
    lastCollectAt: Date | null
    lastCrimeAt: Date | null
    lastRobAt: Date | null
    lastHeistAt: Date | null
    lastDuelAt: Date | null
    sessionCount: number
    lastActionAt: Date | null
    rareMeter: number
    lastRareMeterAt: Date | null
    failStreak: number
    lastResult: string
}

export type IUserSettingModel = IUserSetting & Document

// ── Faction Mongoose document ───────────────────────────────────────────

export interface IFaction {
    key: string
    name: string
    description: string
    treasury: number
    memberCount: number
    bonusProfile: IEconomyBonusProfile
}

export type IFactionModel = IFaction & Document

// ── Economy constants shape ─────────────────────────────────────────────

export interface IEconomyConstants {
    factions: IEconomyFactionDefinition[]
    jobs: IEconomyJob[]
    shopItems: IEconomyShopItem[]
    dailyCashMin: number
    dailyCashMax: number
    begMin: number
    begMax: number
    begCooldownMs: number
    workMin: number
    workMax: number
    workCooldownMs: number
    fishMin: number
    fishMax: number
    fishCooldownMs: number
    fishMissRate: number
    mineMin: number
    mineMax: number
    mineCooldownMs: number
    mineMissRate: number
    huntMin: number
    huntMax: number
    huntCooldownMs: number
    huntMissRate: number
    farmMin: number
    farmMax: number
    farmCooldownMs: number
    investMinAmount: number
    investMinMultiplier: number
    investMaxMultiplier: number
    investLossRate: number
    investDurationMs: number
    collectCooldownMs: number
    crimeSuccessRate: number
    crimeSuccessMin: number
    crimeSuccessMax: number
    crimeFailMin: number
    crimeFailMax: number
    crimeCooldownMs: number
    robSuccessRate: number
    robMinSteal: number
    robMaxSteal: number
    robFailMin: number
    robFailMax: number
    robMinTargetWallet: number
    robCooldownMs: number
    heistSuccessRate: number
    heistMinSteal: number
    heistMaxSteal: number
    heistFailMin: number
    heistFailMax: number
    heistMinTargetBank: number
    heistCooldownMs: number
    duelMinBet: number
    duelMaxBet: number
    duelCooldownMs: number
    coinflipMinBet: number
    coinflipMaxBet: number
    diceMinBet: number
    diceMaxBet: number
    blackjackMinBet: number
    blackjackMaxBet: number
    rouletteMinBet: number
    rouletteMaxBet: number
}