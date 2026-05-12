import MessagePipeline from '../pipeline/MessagePipeline.js'
import CommandModule from '../core/CommandModule.js'
import RuntimeClient from '../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'command_goes_here',
            description: 'command description',
            category: 'category',
            usage: `${client.config.prefix}command`
        })
    }

    //eslint-disable-next-line
    run = async (M: ISimplifiedMessage, args: IParsedArgs): Promise<void> => {}
}
