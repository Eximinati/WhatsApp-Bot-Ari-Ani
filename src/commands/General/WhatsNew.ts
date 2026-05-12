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
        let text = `╭──────────────────────────────╮\n`
        text += `│      🆕  WHAT'S NEW           │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 📅 *May 12, 2026*             │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 🌐 *Social*                   │\n`
        text += `│  meme | news | wiki           │\n`
        text += `│  translate | shorten          │\n`
        text += `│                              │\n`
        text += `│ 🔧 *Utility*                  │\n`
        text += `│  uptime | afk | back          │\n`
        text += `│  calc | define                │\n`
        text += `│                              │\n`
        text += `│ 🎲 *Gaming*                   │\n`
        text += `│  rps | dice | slot | quiz     │\n`
        text += `│                              │\n`
        text += `│ 📱 *WhatsApp*                 │\n`
        text += `│  report | feedback            │\n`
        text += `├──────────────────────────────┤\n`
        text += `│ 📊 *94 commands* | *13 cat.s*  │\n`
        text += `│ 💡 *${p}help* for full list     │\n`
        text += `╰──────────────────────────────╯`
        return void M.reply(text)
    }
}
