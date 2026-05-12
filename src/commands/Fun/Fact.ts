import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'fact',
            description: 'Sends a random fact for you',
            aliases: ['facts'],
            category: 'fun',
            usage: `${client.config.prefix}fact`,
            baseXp: 30
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            const response = await fetch('https://nekos.life/api/v2/fact')
            const data = await response.json() as { fact?: string }

            const fact = data.fact || 'No fact found.'

            return void M.reply(`📝 Random Fact:\n\n💡 ${fact}`)
        } catch {
            return void M.reply('❌ Failed to fetch fact. Try again later.')
        }
    }
}
