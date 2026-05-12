import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'xp',
            description: "Display user's XP",
            category: 'general',
            usage: `${client.config.prefix}xp (@tag)`,
            aliases: ['exp'],
            baseXp: 10
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (M.quoted?.sender) {
            M.mentioned.push(M.quoted.sender)
        }

        const user =
            M.mentioned[0] || M.sender.jid

        const name =
            user === M.sender.jid
                ? M.sender.username
                : user.split('@')[0]

        const xp =
            (await this.client.getUser(user)).Xp || 0

        const text =
`🌟 XP STATUS

👤 User:
➜ ${name}

⭐ XP:
➜ ${xp}`

        await M.reply(text)
    }
}
