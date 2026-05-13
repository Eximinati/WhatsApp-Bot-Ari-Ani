import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'admins',
            description: 'Tag all group admins',
            category: 'general',
            usage: `${client.config.prefix}admins [message]`,
            aliases: ['tagadmins', 'adminstag'],
            baseXp: 10
            
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        try {
            if (!M.groupMetadata) {
                return void M.reply(
                    '❌ This command can only be used in groups.'
                )
            }

            const admins =
                M.groupMetadata.admins || []

            if (!admins.length) {
                return void M.reply(
                    '❌ No admins found in this group.'
                )
            }

            const senderName =
                (M as any).pushName ||
                (M.sender as any)?.username ||
                'User'

            const customMessage =
                (M as any).args?.join(' ') ||
                'Please check the group.'

            let text =
`👑 GROUP ADMINS

📢 Attention admins!

👤 Requested By:
➜ ${senderName}

💬 Message:
➜ ${customMessage}

🔔 Tagged Admins:
`

            for (const admin of admins) {
                const number =
                    admin.split('@')[0]

                text += `➜ @${number}\n`
            }

            await this.client.sendMessage(
                M.from,
                {
                    text: text as any,
                    mentions: admins
                } as any
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
