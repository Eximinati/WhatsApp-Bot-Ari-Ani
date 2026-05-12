import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'whatsnew',
            description: 'Show new features and commands added',
            category: 'general',
            usage: `${client.config.prefix}whatsnew`,
            aliases: ['changelog', 'new', 'updates'],
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const p = this.client.config.prefix

        const text =
`🆕 WHAT'S NEW

📅 May 12, 2026

🌐 Social
• meme
• news
• wiki
• translate
• shorten

🔧 Utility
• uptime
• afk
• back
• calc
• define

🎲 Gaming
• rps
• dice
• slot
• quiz

📱 WhatsApp
• report
• feedback

📊 94 commands | 13 categories

💡 Use ${p}help for full command list`

        await M.reply(text)
    }
}
