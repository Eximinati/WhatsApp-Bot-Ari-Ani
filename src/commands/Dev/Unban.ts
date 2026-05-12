import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'unban',
            description: 'Unban a user from using the bot',
            category: 'dev',
            usage: `${client.config.prefix}unban @user`,
            baseXp: 0,
            modsOnly: true
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        if (M.quoted?.sender) M.mentioned.push(M.quoted.sender)
        const user = M.mentioned[0]
        if (!user) return void M.reply(`╭──────────────────────────────╮\n│      🔓  UNBAN                 │\n├──────────────────────────────┤\n│ ❌ Tag the user to unban       │\n╰──────────────────────────────╯`)
        const data = await this.client.getUser(user)
        if (!data.ban) return void M.reply(`╭──────────────────────────────╮\n│      🔓  UNBAN                 │\n├──────────────────────────────┤\n│ ⚠️ User is not banned         │\n╰──────────────────────────────╯`)
        await this.client.DB.user.updateOne({ jid: user }, { $set: { ban: false }, $unset: { banReason: '' } })
        let text = `╭──────────────────────────────╮\n│      🔓  USER UNBANNED         │\n├──────────────────────────────┤\n│ 👤 @${user.split('@')[0].padEnd(25).slice(0,25)}│\n│ ✅ Status: Unbanned            │\n╰──────────────────────────────╯`
        return void M.reply(text, undefined, undefined, [user])
    }
}
