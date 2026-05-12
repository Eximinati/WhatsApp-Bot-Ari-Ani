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
            baseXp: 0,
            modsOnly: true
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        if (M.quoted?.sender) M.mentioned.push(M.quoted.sender)
        const user = M.mentioned[0]
        if (!user) return void M.reply(`╭──────────────────────────────╮\n│      🔨  BAN                   │\n├──────────────────────────────┤\n│ ❌ Tag the user to ban         │\n│ Usage: *${this.client.config.prefix}ban @user*│\n╰──────────────────────────────╯`)
        const reason = joined.split(' ').filter(p => !p.startsWith('@')).join(' ') || 'No reason'
        const data = await this.client.getUser(user)
        if (data.ban) return void M.reply(`╭──────────────────────────────╮\n│      🔨  BAN                   │\n├──────────────────────────────┤\n│ ⚠️ User is already banned     │\n╰──────────────────────────────╯`)
        await this.client.DB.user.updateOne({ jid: user }, { $set: { ban: true, banReason: reason } })
        let text = `╭──────────────────────────────╮\n│      🔨  USER BANNED           │\n├──────────────────────────────┤\n│ 👤 @${user.split('@')[0].padEnd(25).slice(0,25)}│\n│ 📝 ${reason.substring(0,27).padEnd(27)}│\n╰──────────────────────────────╯`
        return void M.reply(text, undefined, undefined, [user])
    }
}
