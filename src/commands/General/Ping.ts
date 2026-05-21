import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ping',
            description: 'Check bot latency',
            category: 'general',
            usage: `${client.config.prefix}ping`,
            aliases: ['p'],
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        await M.reply('Pong! 🏓')
    }
}
