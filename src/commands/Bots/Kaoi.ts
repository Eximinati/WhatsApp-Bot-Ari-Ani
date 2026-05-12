import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'botinfo',
            description: 'Displays bot information',
            category: 'bots',
            usage: `${client.config.prefix}botinfo`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const uptime = this.getUptime()
        const commands = this.handler.commands.size

        const text =
`🤖 *Ari-Ani's Bot Info*

📛 Name: ${this.client.config.name}

🔧 Prefix: ${this.client.config.prefix}

📦 Commands: ${commands}

⏰ Uptime: ${uptime}

✅ Status: Online

💡 Use ${this.client.config.prefix}help for commands`

        await M.reply(text)
    }

    private getUptime(): string {
        const now = Date.now()
        const start =
            (this.client as any).startTime || now

        const diff = now - start

        const days = Math.floor(diff / 86400000)
        const hours = Math.floor(
            (diff % 86400000) / 3600000
        )
        const minutes = Math.floor(
            (diff % 3600000) / 60000
        )

        return days > 0
            ? `${days}d ${hours}h ${minutes}m`
            : `${hours}h ${minutes}m`
    }
}
