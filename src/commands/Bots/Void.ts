import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ping',
            description: 'Check bot responsiveness',
            category: 'bots',
            usage: `${client.config.prefix}ping`,
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const start = Date.now()

        const msg = await M.reply('🏓 Pinging...')

        const ms = Date.now() - start

        const status =
            ms < 100
                ? '⚡ Excellent'
                : ms < 300
                ? '✅ Good'
                : ms < 500
                ? '🟡 Fair'
                : '🔴 Slow'

        const text =
`🏓 PONG

⏱ Response:
${ms}ms

📊 Status:
${status}

💡 Use ${this.client.config.prefix}uptime`

        await M.reply(text)
    }
}
