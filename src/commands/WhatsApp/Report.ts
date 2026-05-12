import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'report', description: 'Report a bug to the bot owner',
            category: 'whatsapp', usage: `${client.config.prefix}report <bug>`,
            aliases: ['bug', 'issue'], baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const bug = joined.trim()
        if (!bug || bug.length > 500) return void M.reply(`╭──────────────────────────────╮\n│      🐛  REPORT                │\n├──────────────────────────────┤\n│ ❌ Describe the bug            │\n│ 📝 Max 500 chars               │\n╰──────────────────────────────╯`)
        try {
            if (this.client.user?.jid) await this.client.sendMessage(this.client.user.jid, `🐛 *BUG*\n${bug}\n👤 ${M.sender.username}\n💬 ${M.from}`)
            let text = `╭──────────────────────────────╮\n│      🐛  REPORTED              │\n├──────────────────────────────┤\n│ ✅ Thanks for the report!      │\n│ 📝 ${bug.substring(0,26).padEnd(26)}│\n╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      🐛  REPORT                │\n├──────────────────────────────┤\n│ ❌ Failed to send              │\n╰──────────────────────────────╯`)
        }
    }
}
