import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'join',
            description: 'Join a group using invite link',
            category: 'dev',
            dm: true,
            usage: `${client.config.prefix}join <invite_link>`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: IParsedArgs
    ): Promise<void> => {
        const link = joined.trim()

        if (!link) {
            return void M.reply(
                `❌ Usage:\n${this.client.config.prefix}join <invite_link>`
            )
        }

        try {
            await this.client.groupAcceptInvite(link)

            await M.reply(
                '✅ Successfully joined the group.'
            )
        } catch (err) {
            await M.reply(
                '❌ Failed to join group. Invalid or expired invite link.'
            )
        }
    }
}
