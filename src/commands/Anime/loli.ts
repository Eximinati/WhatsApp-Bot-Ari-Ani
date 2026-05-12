import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'loli',
            description: 'Disabled — upstream image source no longer available',
            category: 'anime',
            usage: `${client.config.prefix}loli`
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        return void M.reply('This command has been disabled (image source went offline).')
    }
}
