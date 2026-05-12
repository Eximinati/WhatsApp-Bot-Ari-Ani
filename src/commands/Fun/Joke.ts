import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'joke',
            description: 'Sends a random joke for you',
            category: 'fun',
            usage: `${client.config.prefix}joke`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const response = await fetch('https://v2.jokeapi.dev/joke/Any')
            const data = await response.json() as { category?: string; setup?: string; delivery?: string; joke?: string }
            let text = `╭──────────────────────────────╮\n│      🎃  JOKE                  │\n├──────────────────────────────┤\n│ 📁 ${(data.category || 'Random').padEnd(27).slice(0,27)}│\n│                              │\n│ ${(data.setup || data.joke || '').substring(0,28).padEnd(28)}│\n`
            if (data.delivery) {
                text += `│ ${data.delivery.substring(0,28).padEnd(28)}│\n`
            }
            text += `╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`❌ Failed to fetch joke. Try again later.`)
        }
    }
}
