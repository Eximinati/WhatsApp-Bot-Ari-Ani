import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'
import axios from 'axios'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'crypto',
            aliases: ['cr', 'coins'],
            description: 'Get crypto prices',
            category: 'educative',
            usage: `${client.config.prefix}crypto <COIN> <CURRENCY> [amount]`,
            baseXp: 100
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: IParsedArgs
    ): Promise<void> => {
        const args = joined.trim().toUpperCase().split(/\s+/).filter(Boolean)

        try {
            const { data } = await axios.get(
                'https://public.coindcx.com/market_data/current_prices',
                { timeout: 15000 }
            )

            // 🔹 No input → show all
            if (!args.length) {
                const all = Object.entries(data)
                    .slice(0, 20)
                    .map(([k, v]) => `• ${k}: ${v}`)
                    .join('\n')

                return void M.reply(`💰 Crypto Prices (Top 20)\n\n${all}`)
            }

            const base = args[0]
            const quote = args[1] || 'INR'
            const key = `${base}${quote}`

            const amount = Number(args[2] || 1)
            const multiplier = Number.isFinite(amount) ? amount : 1

            if (!data[key]) {
                return void M.reply(
`❌ Not found: ${key}

Example:
${this.client.config.prefix}crypto BTC INR
${this.client.config.prefix}crypto ETH BTC
${this.client.config.prefix}crypto BTC INR 2`
                )
            }

            const price = data[key]
            const result = price * multiplier

            return void M.reply(
`💰 ${key}
📊 Price: ${price}
🔢 Amount: ${multiplier}
💵 Total: ${result}`
            )

        } catch (err) {
            console.log(err)
            return void M.reply(
                '❌ Crypto API error. Try again later.'
            )
        }
    }
}
