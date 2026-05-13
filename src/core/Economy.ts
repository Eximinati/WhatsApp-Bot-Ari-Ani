import { Schema, model, Document } from 'mongoose'

interface IItem {
    name?: string
    itemName?: string
    description: string
    price: number
    number: number
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

    addMoney(amount: number, type?: 'wallet' | 'bank'): Promise<IEconomy>
    removeMoney(amount: number, type?: 'wallet' | 'bank'): Promise<IEconomy>
}

const economySchema = new Schema<IEconomy>({
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
    }
}, {
    timestamps: true,
    strict: true
})

economySchema.index({ userId: 1 })

economySchema.pre('save', function(next) {
    if (this.wallet < 0) this.wallet = 0
    if (this.bank < 0) this.bank = 0

    next()
})

economySchema.methods.addMoney = async function(
    amount: number,
    type: 'wallet' | 'bank' = 'wallet'
) {
    if (type === 'wallet') {
        this.wallet += amount
    } else {
        this.bank += amount
    }

    return await this.save()
}

economySchema.methods.removeMoney = async function(
    amount: number,
    type: 'wallet' | 'bank' = 'wallet'
) {
    if (type === 'wallet') {
        this.wallet = Math.max(0, this.wallet - amount)
    } else {
        this.bank = Math.max(0, this.bank - amount)
    }

    return await this.save()
}

export default model<IEconomy>('Economy', economySchema)

        protected: {
            type: String,
            default: "none"
        },

        inventory: [
            {
                name: {
                    type: String,
                    required: true
                },

                description: {
                    type: String,
                    default: ""
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
        }
    },
    {
        timestamps: true
    }
);

economySchema.pre("save", function (next) {
    if (this.wallet < 0) this.wallet = 0;
    if (this.bank < 0) this.bank = 0;

    next();
});


economySchema.methods.addMoney = async function (
    amount: number,
    type: "wallet" | "bank" = "wallet"
): Promise<IEconomy> {

    if (type === "wallet") {
        this.wallet += amount;
    } else if (type === "bank") {
        this.bank += amount;
    }

    return await this.save();
};


economySchema.methods.removeMoney = async function (
    amount: number,
    type: "wallet" | "bank" = "wallet"
): Promise<IEconomy> {

    if (type === "wallet") {
        this.wallet = Math.max(0, this.wallet - amount);
    } else if (type === "bank") {
        this.bank = Math.max(0, this.bank - amount);
    }

    return await this.save();
};


const Economy = model<IEconomy, IEconomyModel>(
    "Economy",
    economySchema
);

export default Economy;
