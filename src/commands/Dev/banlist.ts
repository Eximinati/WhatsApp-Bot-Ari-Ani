import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'banlist',
            description: 'Shows all banned users (latest first)',
            category: 'dev',
            usage: `${client.config.prefix}banlist`,
            modsOnly: true,
            baseXp: 0
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const users = await this.client.getBannedUsers()

        if (!users.length) {
            return void M.reply(
                '📭 No banned users found.'
            )
        }

        const total = users.length

        const list = users.map((u: any, i: number) => {
            const jid = u.jid || 'unknown'

            const reason =
                u.banReason || 'No reason'

            const num = total - i

            return `${num}. ${
                jid.split('@')[0]
            } — ${reason}`
        })

        const text = `🚫 Banned User List
📊 Total: ${total}

${list.join('\n')}

💡 Tip: use ${this.client.config.prefix}unban @user`

        await M.reply(text)
    }
}
