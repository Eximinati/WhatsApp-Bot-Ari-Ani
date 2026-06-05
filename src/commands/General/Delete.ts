import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'delete',
            description: 'Delete a quoted bot message',
            aliases: ['del'],
            category: 'general',
            usage: `${client.config.prefix}delete`,
            adminOnly: true,
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            if (!M.quoted?.message) {
                return void M.reply(
                    '❌ Reply to a message you want to delete.'
                )
            }

            if (!this.client.isMe(M.quoted.sender)) {
                return void M.reply(
                    '🔒 I can only delete my own messages.'
                )
            }

            const key = M.quoted.message.key

            if (!key?.id) {
                return void M.reply(
                    '❌ Failed to find message ID.'
                )
            }

            await this.client.deleteMessage(M.from, key)

            await M.reply('✅ Message deleted successfully.')
        } catch (error) {
            console.error(error)

            await M.reply(
                `❌ Error: ${
                    error instanceof Error
                        ? error.message
                        : String(error)
                }`
            )
        }
    }
}
