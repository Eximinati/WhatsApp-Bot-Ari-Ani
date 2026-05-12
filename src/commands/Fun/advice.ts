import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'advice',
            description: 'Get a random piece of advice',
            category: 'fun',
            usage: `${client.config.prefix}advice`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const response = await fetch('https://api.adviceslip.com/advice')
            const data = await response.json() as { slip: { advice: string } }
            let text = `╭──────────────────────────────╮\n│      💡  ADVICE                 │\n├──────────────────────────────┤\n│ ${(data.slip.advice || '').substring(0,28).padEnd(28)}│\n╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`❌ Failed to fetch advice. Try again later.`)
        }
    }
}
