import type { IEconomyConstants } from './types.js'

/**
 * Economy constants — defaults for all timed actions, betting limits,
 * shop items, jobs, and faction definitions. Tweak these to rebalance
 * the economy without touching the service logic.
 */
export const ECONOMY_CONSTANTS: IEconomyConstants = {
    factions: [
        {
            key: 'shadow',
            name: 'Shadow Syndicate',
            description: 'Masters of stealth, heists, and high-risk moves.',
            bonusProfile: {
                reward: { heist: 0.15, rob: 0.1 },
                success: { crime: 0.05, heist: 0.05 },
            },
        },
        {
            key: 'iron',
            name: 'Iron Legion',
            description: 'Disciplined workers who earn more from honest labour.',
            bonusProfile: {
                reward: { work: 0.15, mine: 0.1 },
                cooldown: { work: -0.1, mine: -0.1 },
            },
        },
        {
            key: 'wild',
            name: 'Wild Hunt',
            description: 'Specialists in gathering from the untamed world.',
            bonusProfile: {
                reward: { fish: 0.1, hunt: 0.15 },
                success: { fish: 0.05, hunt: 0.05 },
            },
        },
        {
            key: 'gilded',
            name: 'Gilded Hand',
            description: 'Merchants and investors who play the long game.',
            bonusProfile: {
                payout: { invest: 0.2 },
                cooldown: { invest: -0.1 },
            },
        },
    ],

    jobs: [
        { key: 'unemployed', name: 'Unemployed' },
        { key: 'miner', name: 'Miner', modifiers: { reward: { mine: 0.1 } } },
        { key: 'fisher', name: 'Fisher', modifiers: { reward: { fish: 0.1 } } },
        { key: 'hunter', name: 'Hunter', modifiers: { reward: { hunt: 0.1 } } },
        { key: 'merchant', name: 'Merchant', modifiers: { payout: { invest: 0.1 } } },
        {
            key: 'officer',
            name: 'Officer',
            modifiers: { success: { crime: -0.05 }, cooldown: { work: -0.1 } },
        },
    ],

    shopItems: [
        {
            key: 'lucky_charm',
            name: 'Lucky Charm',
            type: 'consumable',
            price: 200,
            durationMs: 30 * 60 * 1000,
            modifiers: { success: { all: 0.05 } },
        },
        {
            key: 'fishing_rod',
            name: 'Fishing Rod',
            type: 'tool',
            price: 500,
            modifiers: { reward: { fish: 0.1 }, success: { fish: 0.05 } },
        },
        {
            key: 'pickaxe',
            name: 'Pickaxe',
            type: 'tool',
            price: 500,
            modifiers: { reward: { mine: 0.1 }, success: { mine: 0.05 } },
        },
        {
            key: 'energy_drink',
            name: 'Energy Drink',
            type: 'consumable',
            price: 150,
            durationMs: 15 * 60 * 1000,
            modifiers: { cooldown: { all: -0.15 } },
        },
        {
            key: 'xp_booster',
            name: 'XP Booster',
            type: 'consumable',
            price: 300,
            durationMs: 30 * 60 * 1000,
            // XP-only items are handled by the XP system; economy sees no direct modifier.
        },
    ],

    dailyCashMin: 50,
    dailyCashMax: 200,

    begMin: 10,
    begMax: 50,
    begCooldownMs: 2 * 60 * 1000,

    workMin: 20,
    workMax: 100,
    workCooldownMs: 5 * 60 * 1000,

    fishMin: 15,
    fishMax: 80,
    fishCooldownMs: 3 * 60 * 1000,
    fishMissRate: 0.25,

    mineMin: 20,
    mineMax: 100,
    mineCooldownMs: 4 * 60 * 1000,
    mineMissRate: 0.2,

    huntMin: 25,
    huntMax: 120,
    huntCooldownMs: 4 * 60 * 1000,
    huntMissRate: 0.25,

    farmMin: 30,
    farmMax: 150,
    farmCooldownMs: 10 * 60 * 1000,

    investMinAmount: 50,
    investMinMultiplier: 0.8,
    investMaxMultiplier: 1.6,
    investLossRate: 0.3,
    investDurationMs: 15 * 60 * 1000,

    collectCooldownMs: 30 * 1000,

    crimeSuccessRate: 0.55,
    crimeSuccessMin: 50,
    crimeSuccessMax: 300,
    crimeFailMin: 20,
    crimeFailMax: 150,
    crimeCooldownMs: 8 * 60 * 1000,

    robSuccessRate: 0.45,
    robMinSteal: 20,
    robMaxSteal: 150,
    robFailMin: 30,
    robFailMax: 120,
    robMinTargetWallet: 100,
    robCooldownMs: 10 * 60 * 1000,

    heistSuccessRate: 0.35,
    heistMinSteal: 50,
    heistMaxSteal: 400,
    heistFailMin: 40,
    heistFailMax: 200,
    heistMinTargetBank: 200,
    heistCooldownMs: 20 * 60 * 1000,

    duelMinBet: 10,
    duelMaxBet: 500,
    duelCooldownMs: 6 * 60 * 1000,

    coinflipMinBet: 5,
    coinflipMaxBet: 1000,
    diceMinBet: 5,
    diceMaxBet: 1000,
    blackjackMinBet: 10,
    blackjackMaxBet: 1000,
    rouletteMinBet: 5,
    rouletteMaxBet: 1000,
}

// Re-export for convenience — callers can import { constants } from './constants.js'
export const constants = ECONOMY_CONSTANTS