import { Schema, model, Document } from 'mongoose'

export interface IItem {
    name?: string
    itemName?: string
    description: string
    price: number
    number: number
}

export interface IActiveBuff {
    key: string
    name: string

    type: 'buff' | 'pending'

    expiresAt?: Date
    dueAt?: Date

    domain?: string

    modifiers?: Record<string, any>

    data?: Record<string, any>
}

export interface IEconomyStats {
    [key: string]: number
}

export interface IEconomy extends Document {
    userId: string

    wallet: number
    bank: number

    items: IItem[]
    inventory: IItem[]

    protected: string

    lastDaily: Date | null
    lastBegTime: Date | null
    lastWork: Date | null

    lastFishAt: Date | null
    lastMineAt: Date | null
    lastHuntAt: Date | null
    lastCrimeAt: Date | null
    lastRobAt: Date | null
    lastHeistAt: Date | null
    lastDuelAt: Date | null
    lastCollectAt: Date | null
    lastFarmAt: Date | null
    lastInvestAt: Date | null

    rareMeter: number
    lastRareMeterAt: Date | null

    sessionCount: number
    lastActionAt: Date | null

    failStreak: number
    lastResult: string

    streakCount: number
    streakDomain: string
    lastStreakAt: Date | null

    jobKey: string
    factionKey: string
    equippedToolKey: string

    activeBuffs: IActiveBuff[]

    economyStats: IEconomyStats

    addMoney(
        amount: number,
        type?: 'wallet' | 'bank'
    ): Promise<IEconomy>

    removeMoney(
        amount: number,
        type?: 'wallet' | 'bank'
    ): Promise<IEconomy>
}

const economySchema = new Schema<IEconomy>(
    {
        userId: {
            type: String,
            required: true,
            unique: true
        },

        wallet: {
            type: Number,
            default: 100,
            min: 0
        },

        bank: {
            type: Number,
            default: 100,
            min: 0
        },

        items: [
            {
                itemName: String,

                description: {
                    type: String,
                    default: ''
                },

                price: {
                    type: Number,
                    default: 0
                },

                number: {
                    type: Number,
                    default: 1
                }
            }
        ],

        protected: {
            type: String,
            default: 'none'
        },

        inventory: [
            {
                name: String,

                description: {
                    type: String,
                    default: ''
                },

                price: {
                    type: Number,
                    default: 0
                },

                number: {
                    type: Number,
                    default: 1
                }
            }
        ],

        lastDaily: {
            type: Date,
            default: null
        },

        lastBegTime: {
            type: Date,
            default: null
        },

        lastWork: {
            type: Date,
            default: null
        },

        lastFishAt: {
            type: Date,
            default: null
        },

        lastMineAt: {
            type: Date,
            default: null
        },

        lastHuntAt: {
            type: Date,
            default: null
        },

        lastCrimeAt: {
            type: Date,
            default: null
        },

        lastRobAt: {
            type: Date,
            default: null
        },

        lastHeistAt: {
            type: Date,
            default: null
        },

        lastDuelAt: {
            type: Date,
            default: null
        },

        lastCollectAt: {
            type: Date,
            default: null
        },

        lastFarmAt: {
            type: Date,
            default: null
        },

        lastInvestAt: {
            type: Date,
            default: null
        },

        rareMeter: {
            type: Number,
            default: 0
        },

        lastRareMeterAt: {
            type: Date,
            default: null
        },

        sessionCount: {
            type: Number,
            default: 0
        },

        lastActionAt: {
            type: Date,
            default: null
        },

        failStreak: {
            type: Number,
            default: 0
        },

        lastResult: {
            type: String,
            default: ''
        },

        streakCount: {
            type: Number,
            default: 0
        },

        streakDomain: {
            type: String,
            default: ''
        },

        lastStreakAt: {
            type: Date,
            default: null
        },

        jobKey: {
            type: String,
            default: ''
        },

        factionKey: {
            type: String,
            default: ''
        },

        equippedToolKey: {
            type: String,
            default: ''
        },

        activeBuffs: {
            type: [Schema.Types.Mixed],
            default: []
        },

        economyStats: {
            type: Schema.Types.Mixed,
            default: {}
        }
    },
    {
        timestamps: true,
        strict: true
    }
)

economySchema.index({ userId: 1 })

economySchema.pre('save', function (next) {
    if (this.wallet < 0) {
        this.wallet = 0
    }

    if (this.bank < 0) {
        this.bank = 0
    }

    if (this.rareMeter < 0) {
        this.rareMeter = 0
    }

    next()
})

economySchema.methods.addMoney = async function (
    amount: number,
    type: 'wallet' | 'bank' = 'wallet'
): Promise<IEconomy> {
    if (type === 'wallet') {
        this.wallet += amount
    } else {
        this.bank += amount
    }

    return await this.save()
}

economySchema.methods.removeMoney = async function (
    amount: number,
    type: 'wallet' | 'bank' = 'wallet'
): Promise<IEconomy> {
    if (type === 'wallet') {
        this.wallet = Math.max(0, this.wallet - amount)
    } else {
        this.bank = Math.max(0, this.bank - amount)
    }

    return await this.save()
}

const Economy = model<IEconomy>('Economy', economySchema)

export default Economy
