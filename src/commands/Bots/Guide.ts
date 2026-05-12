import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'guide',
            description: 'Shows guide for new users',
            category: 'bots',
            usage: `${client.config.prefix}guide`,
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const p = this.client.config.prefix

        const text =
`📖 USER GUIDE

✨ Quick Start
• Use ${p}help to begin

📁 Categories (13 total)

🌐 Social
🔧 Utility
🎲 Gaming
📱 WhatsApp
📺 Anime
🤖 Bots
⚙️ Config
👨‍💻 Dev
📚 Educative
🎮 Fun
📋 General
📼 Media
🛡️ Moderation

💡 Use ${p}whatsnew for latest updates`

        await M.reply(text)
    }
}
