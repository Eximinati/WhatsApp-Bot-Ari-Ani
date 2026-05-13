import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'invitelink',
            aliases: ['invite', 'linkgc'],
            description: 'Get the group invite link',
            category: 'general',
            usage: `${client.config.prefix}invitelink`,
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            if (!M.groupMetadata) {
                return void M.reply(
                    '❌ This command only works in groups.'
                )
            }

            if (!this.client.isBotAdmin(M.groupMetadata)) {
                return void M.reply(
                    "🔒 I'm not an admin in this group."
                )
            }

            const groupData =
                await this.client.getGroupData(M.from)

            if (!groupData.invitelink) {
                return void M.reply(
                    `❌ Enable invite links first using ${this.client.config.prefix}act invitelink`
                )
            }

            const code = await this.client
                .groupInviteCode(M.from)
                .catch(() => '')

            if (!code) {
                return void M.reply(
                    '❌ Failed to retrieve the invite link.'
                )
            }

            const inviteLink = `https://chat.whatsapp.com/${code}`

            await M.reply(
`🔗 GROUP INVITE LINK

${inviteLink}

⚠️ Do not share with unknown users.`
            )
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
