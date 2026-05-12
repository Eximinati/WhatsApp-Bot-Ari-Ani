import MessagePipeline from '../../pipeline/MessagePipeline.js'
import CommandModule from '../../core/CommandModule.js'
import RuntimeClient from '../../core/RuntimeClient.js'
import { ISimplifiedMessage } from '../../typings/index.js'

export default class Command extends CommandModule {
    constructor(client: RuntimeClient, handler: MessagePipeline) {
        super(client, handler, {
            command: 'guide',
            description: 'Shows the guide for new users',
            category: 'bots',
            usage: `${client.config.prefix}guide`,
            baseXp: 5
        })
    }

    run = async (M: ISimplifiedMessage): Promise<void> => {
        const p = this.client.config.prefix
        let text = `╭──────────────────────────────╮\n`
        text += `│      📖  USER GUIDE            │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ ✨ *Quick Start*               │\n`
        text += `│  Use *${p}help* to begin        │\n`
        text += `│                              │\n`
        text += `│ 📁 *Categories (13 total)*    │\n`
        text += `│ 🌐 Social   🔧 Utility        │\n`
        text += `│ 🎲 Gaming   📱 WhatsApp       │\n`
        text += `│ 📺 Anime    🤖 Bots           │\n`
        text += `│ ⚙️ Config   👨‍💻 Dev           │\n`
        text += `│ 📚 Educative 🎮 Fun           │\n`
        text += `│ 📋 General  📼 Media          │\n`
        text += `│ 🛡️ Moderation                 │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 💡 *${p}whatsnew* for updates   │\n`
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
