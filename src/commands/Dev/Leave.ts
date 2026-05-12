import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'leave',
            description: 'Leave the current group',
            category: 'dev',
            usage: `${client.config.prefix}leave`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (!M.groupMetadata) {
            return void M.reply('❌ This command only works in groups.')
        }

        const groupName = M.groupMetadata.subject || 'this group'

        await M.reply(`👋 Leaving group: ${groupName}`)

        await this.client.groupLeave(M.from)
    }
}
