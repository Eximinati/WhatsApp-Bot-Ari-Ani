import type {
    IInventory,
    IEconomyStats,
    IActiveEntry,
    IUserSetting,
    IEconomyBonusProfile,
    IBalanceSummary,
    IEconomyShopItem,
} from './types.js'

// ── Money clamping ─────────────────────────────────────────────────────

/** Clamp a number to the safe integer range so MongoDB never stores out-of-
 *  bounds values. Also floors to integer (economy is coin-based). */
export function clampMoney(value: number | undefined | null): number {
    if (value == null || Number.isNaN(value)) return 0
    const floored = Math.floor(value)
    if (floored > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER
    if (floored < Number.MIN_SAFE_INTEGER) return Number.MIN_SAFE_INTEGER
    return floored
}

// ── Formatting ──────────────────────────────────────────────────────────

/** Format a raw coin amount as a human-readable string with K/M suffix.
 *  Example: 1_500_000 → "1.5M", 25_000 → "25K".  */
export function formatMoney(value: number): string {
    const v = clampMoney(value)
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`
    return String(v)
}

/** Format a duration in ms to a short human string (e.g. "2m 30s"). */
export function formatDurationMs(ms: number): string {
    if (ms <= 0) return '0s'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
}

// ── Random ──────────────────────────────────────────────────────────────

/** Return a random integer between min and max (inclusive). */
export function randomBetween(min: number, max: number): number {
    if (min > max) [min, max] = [max, min]
    return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── JSON parsing helpers ────────────────────────────────────────────────

/** Safely parse a JSON string as an object (returns `{}` on failure). */
export function parseJsonObject(raw: string | undefined | null): Record<string, unknown> {
    try {
        const parsed = JSON.parse(raw || '{}')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {}
    } catch {
        return {}
    }
}

/** Safely parse a JSON string as an array (returns `[]` on failure). */
export function parseJsonArray(raw: string | undefined | null): unknown[] {
    try {
        const parsed = JSON.parse(raw || '[]')
        return Array.isArray(parsed) ? (parsed as unknown[]) : []
    } catch {
        return []
    }
}

// ── Inventory ───────────────────────────────────────────────────────────

/** Parse a JSON-serialized inventory string into a typed map. */
export function parseInventory(raw: string | undefined | null): IInventory {
    const obj = parseJsonObject(raw)
    const result: IInventory = {}
    for (const [key, value] of Object.entries(obj)) {
        result[key] = clampMoney(value as number)
    }
    return result
}

/** Serialize an inventory map back to a deterministic JSON string. */
export function stringifyInventory(inv: IInventory): string {
    // Sort keys for stability
    const sorted: Record<string, number> = {}
    for (const key of Object.keys(inv).sort()) {
        sorted[key] = clampMoney(inv[key])
    }
    return JSON.stringify(sorted)
}

// ── Active buffs / entries ──────────────────────────────────────────────

/** Narrow an unknown parsed entry to a typed active entry (or null). */
export function castActiveEntry(raw: unknown): IActiveEntry | null {
    if (!raw || typeof raw !== 'object') return null
    const entry = raw as Record<string, unknown>
    if (typeof entry.key !== 'string') return null
    if (typeof entry.type !== 'string') return null
    if (entry.type === 'buff' || entry.type === 'pending') {
        return entry as unknown as IActiveEntry
    }
    return null
}

/** Parse and validate the active-buffs JSON blob from a user document. */
export function filterActiveEntries(entries: IActiveEntry[]): IActiveEntry[] {
    return entries.filter((entry) => {
        if (entry.type === 'buff' && entry.expiresAt) {
            return new Date(entry.expiresAt).getTime() > Date.now()
        }
        // Pending entries are checked by their dueAt elsewhere
        return true
    })
}

// ── Amount / bet parsing ────────────────────────────────────────────────

/** Parse a user-supplied amount input (number or shorthand like "1k", "2m",
 *  "all", "half"). Falls back to the available balance when "all"/"half" is used. */
export function parseAmountInput(
    input: string | number | undefined | null,
    available: number,
): number {
    const raw = String(input ?? '').trim().toLowerCase()
    if (!raw) return 0

    if (raw === 'all' || raw === 'max') return clampMoney(available)
    if (raw === 'half') return clampMoney(Math.floor(available / 2))

    // Shorthand: 1k = 1_000, 1.5m = 1_500_000
    const shorthand = raw.match(/^(-?\d+(?:\.\d+)?)([km])?$/)
    if (shorthand) {
        let value = Number.parseFloat(shorthand[1])
        if (shorthand[2] === 'k') value *= 1_000
        if (shorthand[2] === 'm') value *= 1_000_000
        return clampMoney(Math.floor(value))
    }

    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? clampMoney(parsed) : 0
}

/** Parse and validate a bet amount against min/max/available constraints.
 *  Throws if the bet is out of range. */
export function parseBetInput(
    input: string | number | undefined | null,
    opts: { minBet: number; maxBet: number; available: number },
): number {
    const bet = parseAmountInput(input, opts.available)
    if (bet < opts.minBet) {
        throw new Error(`Minimum bet is ${formatMoney(opts.minBet)}.`)
    }
    if (bet > opts.maxBet) {
        throw new Error(`Maximum bet is ${formatMoney(opts.maxBet)}.`)
    }
    if (bet > opts.available) {
        throw new Error(`You only have ${formatMoney(opts.available)} available.`)
    }
    return bet
}

// ── Wealth ──────────────────────────────────────────────────────────────

/** Total wealth = wallet + bank (clamped). */
export function totalWealth(account: { wallet: number; bank: number }): number {
    return clampMoney(clampMoney(account.wallet) + clampMoney(account.bank))
}

// ── Bonus profile helpers ───────────────────────────────────────────────

/** Sum a specific bonus bucket (reward / payout / cooldown / success) across
 *  all entities that carry a `modifiers` or `bonusProfile` field. */
export function sumDomainModifier(
    entities: Array<{
        modifiers?: IEconomyBonusProfile | null
        bonusProfile?: IEconomyBonusProfile | null
    }>,
    bucket: keyof IEconomyBonusProfile,
    domain: string,
): number {
    return entities.reduce((sum, entity) => {
        const base = entity?.modifiers || entity?.bonusProfile || {}
        const scoped = base?.[bucket] || {}
        return (
            sum +
            (Number(scoped.all) || 0) +
            (Number((scoped as Record<string, number>)[domain]) || 0)
        )
    }, 0)
}

// ── Streak helpers ──────────────────────────────────────────────────────

export const STREAK_TIMEOUT = 5 * 60 * 1000

/** Compute streak bonus multiplier: 0.05 per streak, capped at +0.50. */
export function getStreakBonus(streakCount: number): number {
    return Math.min(streakCount * 0.05, 0.5)
}

// ── Session helpers ─────────────────────────────────────────────────────

export const RARE_METER_TIMEOUT = 5 * 60 * 1000

/** Update the session counter. Returns the new session count. */
export function updateSession(account: { lastActionAt?: Date | null; sessionCount?: number }): number {
    const now = Date.now()
    const lastAction = account.lastActionAt ? new Date(account.lastActionAt).getTime() : 0

    if (lastAction && now - lastAction < RARE_METER_TIMEOUT) {
        account.sessionCount = (account.sessionCount || 0) + 1
    } else {
        account.sessionCount = 1
    }
    account.lastActionAt = new Date()
    return account.sessionCount
}

// ── Rare meter decay ────────────────────────────────────────────────────

/** Apply rare-meter decay: -10 per 24 hours since last update. */
export function applyRareMeterDecay(account: { lastRareMeterAt?: Date | null; rareMeter?: number }): number {
    if (!account.lastRareMeterAt || !account.rareMeter) return 0
    const hoursPassed = (Date.now() - new Date(account.lastRareMeterAt).getTime()) / (60 * 60 * 1000)
    const decay = Math.floor(hoursPassed / 24) * 10
    return Math.max(0, account.rareMeter - decay)
}

// ── Rare event roll ─────────────────────────────────────────────────────

export interface IRareEvent {
    text: string
    type: 'coins' | 'xp' | 'multi'
    bonusMult: number
    bonus?: number
    xpBonus?: number
}

const RARE_EVENTS: IRareEvent[] = [
    { text: '💰 Hidden treasure!', type: 'coins', bonusMult: 5 },
    { text: '✨ XP Surge!', type: 'xp', bonusMult: 2 },
    { text: '⚡ Lucky strike!', type: 'coins', bonusMult: 3 },
    { text: '🌟 Rare find!', type: 'coins', bonusMult: 4 },
    { text: '🎯 Perfect catch!', type: 'multi', bonusMult: 2 },
]

export function rollRareEvent(
    baseBonus: number,
    baseXp: number,
    domain: string,
    rareMeter = 0,
): IRareEvent | null {
    const domainChance: Record<string, number> = {
        fish: 0.03,
        mine: 0.035,
        hunt: 0.04,
        work: 0.02,
        beg: 0.015,
    }
    const baseChance = domainChance[domain] || 0.02
    const boostedChance = baseChance + (rareMeter / 100) * 0.1
    if (Math.random() > boostedChance) return null
    const event = RARE_EVENTS[Math.floor(Math.random() * RARE_EVENTS.length)]
    return {
        ...event,
        type: event.type,
        bonus: event.type === 'coins' ? Math.floor(baseBonus * event.bonusMult) : 0,
        xpBonus: event.type === 'xp' ? Math.floor(baseXp * event.bonusMult) : 0,
    }
}

// ── Buff record factory ─────────────────────────────────────────────────

/** Create a buff entry for a consumable shop item. */
export function createBuffRecord(item: IEconomyShopItem): IActiveEntry & { type: 'buff' } {
    return {
        key: item.key,
        name: item.name,
        type: 'buff' as const,
        expiresAt: new Date(Date.now() + (item.durationMs || 0)).toISOString(),
        modifiers: item.modifiers || {},
    }
}

// ── Balance formatting ──────────────────────────────────────────────────

/** Build the "Wallet: / Bank: / Total:" lines for a balance summary. */
export function formatBalanceLines(balance: IBalanceSummary): string[] {
    return [
        `Wallet: ${formatMoney(balance.wallet)}`,
        `Bank: ${formatMoney(balance.bank)}`,
        `Total wealth: ${formatMoney(balance.totalWealth)}`,
    ]
}