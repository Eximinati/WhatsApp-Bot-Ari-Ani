import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

import getEconomy from '../../pipeline/getEconomy.js'

const DAILY_AMOUNT = 1000
const COOLDOWN = 24 * 60 * 60 * 1000

function formatMoney(amount: number): string {
    return `$${amount.toLocaleString()}`
}

export default class Command extends CommandModule {
    constructor(
        client: RuntimeClient,
        handler: MessagePipeline
    ) {
        super(client, handler, {
            command: 'daily',
            description: 'Claim your daily reward',
            category: 'economy',
            usage: `${client.config.prefix}daily`,
            aliases: ['claim'],
            baseXp: 10
        })
    }

    run = async (
        M: ISimplifiedMessage
    ): Promise<void> => {
        try {
            const economy = await getEconomy(
                M.sender.jid
            )

            const now = Date.now()

            if (
                economy.lastDaily &&
                now - economy.lastDaily.getTime() <
                    COOLDOWN
            ) {
                const remaining =
                    COOLDOWN -
                    (now -
                        economy.lastDaily.getTime())

                const hours = Math.floor(
                    remaining / 3600000
                )

                const minutes = Math.floor(
                    (remaining % 3600000) / 60000
                )

                const seconds = Math.floor(
                    (remaining % 60000) / 1000
                )

                return void M.reply(
`⏳ *Daily Already Claimed*

🕒 Come back in:
⏰ ${hours}h ${minutes}m ${seconds}s`
                )
            }

            economy.wallet += DAILY_AMOUNT
            economy.lastDaily = new Date()

            
            economy.totalEarned += DAILY_AMOUNT
            economy.dailyStreak += 1

            
            if (
                economy.dailyStreak % 7 === 0
            ) {
                const streakBonus = 2500

                economy.wallet += streakBonus
                economy.totalEarned +=
                    streakBonus

                await economy.save()

                return void M.reply(
`🎁 *Daily Reward Claimed*

💵 Daily Reward: ${formatMoney(
    DAILY_AMOUNT
)}

🔥 Streak Bonus: ${formatMoney(
    streakBonus
)}

📆 Daily Streak: ${
    economy.dailyStreak
} days

👛 Wallet: ${formatMoney(
    economy.wallet
)}`
                )
            }

            await economy.save()

            return void M.reply(
`🎁 *Daily Reward Claimed*

💵 Earned: ${formatMoney(
    DAILY_AMOUNT
)}

📆 Daily Streak: ${
    economy.dailyStreak
} days

👛 Wallet: ${formatMoney(
    economy.wallet
)}

💰 Total Earned: ${formatMoney(
    economy.totalEarned
)}`
            )
        } catch (err) {
            this.client.log(
                String(err),
                true
            )

            return void M.reply(
                '❌ Failed to claim daily reward.'
            )
        }
    }
}
