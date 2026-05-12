import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'quote',
            description: 'Sends a random quote for you',
            category: 'fun',
            usage: `${client.config.prefix}quote`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const response = await fetch('https://api.quotable.io/random')
            const data = await response.json() as { content?: string; author?: string }
            let text = `╭──────────────────────────────╮\n│      💬  QUOTE                  │\n├──────────────────────────────┤\n│ 📝 *"${(data.content || '').substring(0,22).padEnd(22)}*│\n│                              │\n│ ✍️ — *${(data.author || 'Unknown').padEnd(22).slice(0,22)}│\n╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`❌ Failed to fetch quote. Try again later.`)
        }
    }
}
