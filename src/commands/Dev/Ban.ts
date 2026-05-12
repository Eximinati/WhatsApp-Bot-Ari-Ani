import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'ban',
            description: 'Ban a user from using the bot',
            category: 'dev',
            usage: `${client.config.prefix}ban @user [reason]`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (
        M: ISimplifiedMessage,
        { joined }: IParsedArgs
    ): Promise<void> => {
        if (M.quoted?.sender) {
            M.mentioned.push(M.quoted.sender)
        }

        const user =
            M.mentioned[0]

        if (!user) {
            return void M.reply(
                `❌ Usage:\n${this.client.config.prefix}ban @user [reason]`
            )
        }

        const reason =
            joined
                .split(' ')
                .filter(p => !p.startsWith('@'))
                .join(' ')
                .trim() || 'No reason provided'

        const data =
            await this.client.getUser(user)

        if (data?.ban) {
            return void M.reply(
                '⚠️ User is already banned.'
            )
        }

        await this.client.DB.user.updateOne(
            { jid: user },
            {
                $set: {
                    ban: true,
                    banReason: reason
                }
            }
        )

        const text =
`🔨 USER BANNED

👤 User: ${user.split('@')[0]}
📝 Reason: ${reason}`

        return void M.reply(text, undefined, undefined, [
            user
        ])
    }
}
