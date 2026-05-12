import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { IParsedArgs, ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'feedback', description: 'Send feedback to the bot owner',
            category: 'whatsapp', usage: `${client.config.prefix}feedback <msg>`,
            aliases: ['suggest', 'idea'], baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage, { joined }: IParsedArgs): Promise<void> => {
        const fb = joined.trim()
        if (!fb || fb.length > 500) return void M.reply(`╭──────────────────────────────╮\n│      💬  FEEDBACK              │\n├──────────────────────────────┤\n│ ❌ Write your feedback         │\n│ 📝 Max 500 chars               │\n╰──────────────────────────────╯`)
        try {
            if (this.client.user?.jid) await this.client.sendMessage(this.client.user.jid, `💬 *FEEDBACK*\n${fb}\n👤 ${M.sender.username}\n💬 ${M.from}`)
            let text = `╭──────────────────────────────╮\n│      💬  FEEDBACK SENT         │\n├──────────────────────────────┤\n│ ✅ Thanks for your input!      │\n│ 📝 ${fb.substring(0,26).padEnd(26)}│\n╰──────────────────────────────╯`
            return void M.reply(text)
        } catch {
            return void M.reply(`╭──────────────────────────────╮\n│      💬  FEEDBACK              │\n├──────────────────────────────┤\n│ ❌ Failed to send              │\n╰──────────────────────────────╯`)
        }
    }
}
