import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

import getEconomy from '../../pipeline/getEconomy.js'

const DAILY_AMOUNT = 5000
const COOLDOWN = 24 * 60 * 60 * 1000

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'daily',
            description: 'Claim your daily reward',
            category: 'economy',
            usage: `${client.config.prefix}daily`,
            aliases: ['claim'],
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const economy = await getEconomy(M.sender.jid)

            const now = Date.now()

            if (
                economy.lastDaily &&
                now - economy.lastDaily.getTime() < COOLDOWN
            ) {
                const remaining =
                    COOLDOWN - (now - economy.lastDaily.getTime())

                const hours = Math.floor(remaining / 3600000)

                const minutes = Math.floor(
                    (remaining % 3600000) / 60000
                )

                return void M.reply(
`⏳ You already claimed your daily reward.

Come back in ${hours}h ${minutes}m`
                )
            }

            economy.wallet += DAILY_AMOUNT
            economy.lastDaily = new Date()

            await economy.save()

            return void M.reply(
`🎁 Daily Reward Claimed

💵 Earned: ${DAILY_AMOUNT}
💰 Wallet: ${economy.wallet}`
            )
        } catch (err) {
            this.client.log(String(err), true)

            return void M.reply(
                '❌ Failed to claim daily reward.'
            )
        }
    }
}
