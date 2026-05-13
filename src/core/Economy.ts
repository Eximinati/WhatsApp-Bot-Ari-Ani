import { Schema, model, Document, Model } from "mongoose";


interface IItem {
    itemName?: string;
    name?: string;
    description: string;
    price: number;
    number: number;
}


export interface IEconomy extends Document {
    userId: string;

    wallet: number;
    bank: number;

    items: IItem[];

    protected: string;

    inventory: IItem[];

    lastDaily: Date | null;
    lastBegTime: Date | null;
    lastWork: Date | null;

    createdAt: Date;
    updatedAt: Date;

    addMoney(amount: number, type?: "wallet" | "bank"): Promise<IEconomy>;
    removeMoney(amount: number, type?: "wallet" | "bank"): Promise<IEconomy>;
}


interface IEconomyModel extends Model<IEconomy> {}


const economySchema = new Schema<IEconomy>(
    {
        userId: {
            type: String,
            required: true,
            unique: true
        },

        wallet: {
            type: Number,
            default: 3557,
            max: Number.MAX_SAFE_INTEGER
        },

        bank: {
            type: Number,
            default: 548,
            max: Number.MAX_SAFE_INTEGER
        },

        items: [
            {
                itemName: {
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
