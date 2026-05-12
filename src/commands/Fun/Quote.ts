import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

interface QuoteResponse {
    content?: string
    author?: string
}

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
            const data = (await response.json()) as QuoteResponse

            const quote = data.content || 'No quote found.'
            const author = data.author || 'Unknown'

            return void M.reply(
                `💬 Quote:\n\n"${quote}"\n\n— ${author}`
            )
        } catch {
            return void M.reply('❌ Failed to fetch quote. Try again later.')
        }
    }
}
